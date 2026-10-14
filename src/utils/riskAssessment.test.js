import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { buildRiskAssessment, createSavedAnalysisPayload } from "./riskAssessment.js";
import analyzeOffer, { extractLinks } from "./analyzeOffer.js";
import unsolicitedInternship from "./fixtures/unsolicitedInternship.js";
import analyzeLinks from "./analyzeLinks.js";
import analyzeEmail from "./analyzeEmail.js";
import { combineWeightedEvidence, riskBand } from "./scoring.js";

test("confirmed malicious URL reputation contributes strongly to the overall assessment", () => {
  const offer = analyzeOffer(unsolicitedInternship);
  const assessment = buildRiskAssessment(offer, null, [{
    url: extractLinks(unsolicitedInternship)[0],
    findings: [],
    reputation: { state: "success", data: { status: "malicious_detections", detections: { malicious: 5, suspicious: 0 } } },
  }]);
  assert.ok(assessment.overallScore > 80);
  assert.equal(assessment.level.label, "Very High");
  assert.ok(assessment.findings.some((finding) => finding.category === "Malicious URL reputation" && finding.severity === "high"));
  assert.ok(assessment.findings.every((finding) => !finding.id.includes("private-token")));
});

test("no existing VirusTotal report is unknown, not a clean bill of health", () => {
  const assessment = buildRiskAssessment({ score: 0, findings: [] }, null, [{
    url: "https://example.test/form",
    findings: [],
    reputation: { state: "success", data: { status: "no_data", available: false } },
  }]);
  assert.equal(assessment.overallScore, 0);
  assert.equal(assessment.urlChecksIncomplete, true);
  assert.equal(assessment.findings[0].category, "No VirusTotal report available");
  assert.equal(assessment.urlChecks[0].reputation.data.status, "no_data");
});

test("pending and unusable VirusTotal verdicts are marked incomplete and add no risk", () => {
  for (const status of ["pending", "inconclusive"]) {
    const assessment = buildRiskAssessment({ findings: [] }, null, [{
      url: "https://pending.example/test",
      findings: [],
      reputation: { state: "success", data: { status } },
    }]);
    assert.equal(assessment.overallScore, 0);
    assert.equal(assessment.urlChecksIncomplete, true);
  }
});

test("a shortened link alone is informational and adds no risk points", () => {
  const [link] = analyzeLinks(["http://bit.ly/job-login"]);
  const assessment = buildRiskAssessment({ score: 0, findings: [] }, null, [{
    ...link,
    reputation: { state: "success", data: { status: "no_data", available: false } },
  }]);
  assert.equal(link.findings[0].reason, "Shortened link: unable to verify final destination.");
  assert.equal(link.findings.length, 1);
  assert.equal(assessment.overallScore, 0);
  assert.ok(assessment.findings.some((finding) => finding.category === "Shortened URL" && finding.weight === 0));
  assert.ok(assessment.urlChecksIncomplete);
});

test("unknown shortened destinations remain unverifiable without adding points", () => {
  const [link] = analyzeLinks(["https://t.co/offer"]);
  const assessment = buildRiskAssessment({ score: 0, findings: [] }, null, [link]);
  assert.equal(assessment.overallScore, 0);
  assert.equal(assessment.urlChecksIncomplete, true);
  assert.equal(link.findings[0].severity, "info");
  assert.equal(link.findings[0].informational, true);
});

test("a clean reputation response does not turn a shortened link into a risk", () => {
  const [link] = analyzeLinks(["https://cutt.ly/offer"]);
  const assessment = buildRiskAssessment({ score: 0, findings: [] }, null, [{
    ...link,
    reputation: { state: "success", data: { status: "no_threats_detected", detections: { malicious: 0, suspicious: 0 } } },
  }]);
  assert.equal(assessment.overallScore, 0);
  assert.equal(assessment.urlChecksIncomplete, false);
  assert.equal(link.findings[0].informational, true);
});

test("genuine malicious reputation evidence for a shortened URL still contributes", () => {
  const [link] = analyzeLinks(["https://tinyurl.com/offer"]);
  const assessment = buildRiskAssessment({ score: 0, findings: [] }, null, [{
    ...link,
    reputation: { state: "success", data: { status: "malicious_detections", detections: { malicious: 2, suspicious: 0 } } },
  }]);
  assert.equal(assessment.findings.find((finding) => finding.category === "Malicious URL reputation").weight, 80);
  assert.ok(assessment.findings.some((finding) => finding.category === "Malicious URL reputation"));
});

test("API errors and rate limits add no fabricated VirusTotal result", () => {
  for (const message of ["Service unavailable", "VirusTotal request limit reached"]) {
    const assessment = buildRiskAssessment({ score: 0, findings: [] }, null, [{
      url: "https://example.test/form",
      findings: [],
      reputation: { state: "error", message },
    }]);
    assert.equal(assessment.overallScore, 0);
    assert.ok(assessment.findings.some((finding) => finding.category === "VirusTotal check unavailable"));
    assert.equal(assessment.urlChecksIncomplete, true);
  }
});

test("per-URL signals use the strongest local or VirusTotal score without duplicate addition", () => {
  const assessment = buildRiskAssessment({ score: 10, findings: [{ id: "message", category: "Offer concern", severity: "low", weight: 10, reason: "Review the message." }] }, null, [{
    url: "https://example.test/login",
    findings: [{ type: "Sensitive-action URL path", severity: "low", reason: "Review the destination." }],
    reputation: { state: "success", data: { status: "suspicious_detections", detections: { malicious: 0, suspicious: 2 } } },
  }]);
  assert.equal(assessment.findings.find((finding) => finding.category === "Sensitive-action URL path").weight, 5);
  assert.equal(assessment.findings.find((finding) => finding.category === "Suspicious URL reputation").weight, 35);
  assert.equal(assessment.overallScore, 42);
});

test("distinct URLs each contribute their strongest signal while duplicates are removed", () => {
  const link = (url) => ({ url, findings: [], reputation: { state: "success", data: { status: "malicious_detections", detections: { malicious: 1 } } } });
  const assessment = buildRiskAssessment({ score: 0, findings: [] }, null, [link("https://one.test/a#first"), link("https://two.test/b"), link("https://one.test/a#second")]);
  assert.equal(assessment.overallScore, 96);
  assert.equal(assessment.findings.filter((finding) => finding.category === "Malicious URL reputation").length, 2);
});

test("a custom sender domain that differs from the linked site is a single review signal", () => {
  const email = analyzeEmail("recruiter@company.example");
  const links = analyzeLinks(["https://unrelated.example/jobs"]);
  const assessment = buildRiskAssessment({ findings: [] }, email, links.map((link) => ({ ...link, reputation: { state: "success", data: { status: "no_threats_detected" } } })));
  assert.equal(assessment.findings.filter((finding) => finding.category === "Sender and link domains differ").length, 1);
  assert.ok(assessment.overallScore >= 18);
});

test("evidence groups deduplicate overlapping signals and bands are documented", () => {
  const duplicate = combineWeightedEvidence([
    { id: "fee", scoringGroup: "payment-demand", weight: 35 },
    { id: "urgent-fee", scoringGroup: "payment-demand", weight: 25 },
  ]);
  assert.equal(duplicate, 35);
  assert.equal(riskBand(19).label, "Low");
  assert.equal(riskBand(20).label, "Moderate");
  assert.equal(riskBand(45).label, "High");
  assert.equal(riskBand(70).label, "Very High");
});

test("saved history payload stores the final combined score and sanitized findings", () => {
  const assessment = buildRiskAssessment(
    { findings: [{ id: "fee", category: "Payment request", severity: "high", weight: 30, scoringGroup: "payment-demand", evidence: "private quote", reason: "A payment was requested." }] },
    null,
    [{ url: "https://bad.test", findings: [], reputation: { state: "success", data: { status: "malicious_detections", detections: { malicious: 1 } } } }],
  );
  const payload = createSavedAnalysisPayload(assessment, ["Verify independently."], "bad.test");
  assert.equal(payload.score, assessment.overallScore);
  assert.equal(payload.level, "very-high");
  assert.ok(payload.findings.every((finding) => !("evidence" in finding) && !("scoringGroup" in finding)));
});

test("frontend renders a simplified score and hides URL score details", async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    const { default: AnalysisResults } = await vite.ssrLoadModule("/src/components/AnalysisResults.jsx");
    const assessment = buildRiskAssessment(
      { findings: [{ id: "deadline", category: "Urgent registration deadline", severity: "medium", weight: 15, evidence: "Register within 24 hours.", reason: "A short registration deadline deserves verification." }] },
      null,
      [{ url: "https://safe.test", findings: [], reputation: { state: "success", data: { status: "malicious_detections", detections: { malicious: 4 } } } }],
    );
    const markup = renderToStaticMarkup(React.createElement(AnalysisResults, {
      results: { ...assessment, score: 25, level: "moderate", findings: assessment.findings, recommendations: [] },
      assessment,
    }));
    assert.match(markup, /\d+\/100/);
    assert.match(markup, /Register within 24 hours/);
    assert.doesNotMatch(markup, /Malicious URL reputation/);
    assert.match(markup, /Very High/);
    assert.doesNotMatch(markup, /\+\s*\d+\s*points|Message:.*points|capped at 100/i);

    const unavailable = buildRiskAssessment({ score: 0, findings: [] }, null, [{
      url: "https://unavailable.test", findings: [], reputation: { state: "error", message: "Rate limited" },
    }]);
    const unavailableMarkup = renderToStaticMarkup(React.createElement(AnalysisResults, {
      results: { score: 0, level: "lower", findings: [], recommendations: [] },
      assessment: unavailable,
    }));
    assert.match(unavailableMarkup, /Risk score based on message content, sender details, and URL security checks\./i);
    assert.doesNotMatch(unavailableMarkup, /URL checks are incomplete/i);
  } finally {
    await vite.close();
  }
});
