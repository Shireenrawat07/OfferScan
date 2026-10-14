import { combineWeightedEvidence, riskBand } from "./scoring.js";

const shortenerDomains = ["bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "rb.gy", "shorturl.at"];
const thirdPartyFormDomains = ["forms.gle", "docs.google.com", "forms.office.com", "typeform.com", "jotform.com", "lever.co", "greenhouse.io", "ashbyhq.com", "workday.com", "myworkdayjobs.com", "smartrecruiters.com", "icims.com", "bamboohr.com", "jobvite.com", "taleo.net", "successfactors.com"];
const freeEmailDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "icloud.com", "proton.me", "protonmail.com"];

function canonicalUrl(value) {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    url.hash = "";
    if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
    return url.href;
  } catch { return String(value || "").trim().toLowerCase(); }
}

function rootDomain(host) {
  const labels = host.toLowerCase().split(".").filter(Boolean);
  const compoundSuffixes = ["co.uk", "org.uk", "gov.uk", "ac.uk", "com.au", "com.in", "co.in", "co.jp", "co.nz", "com.br", "co.za"];
  if (labels.length >= 3 && compoundSuffixes.includes(labels.slice(-2).join("."))) return labels.slice(-3).join(".");
  return labels.length <= 2 ? labels.join(".") : labels.slice(-2).join(".");
}

function scoreUrl(link, linkIndex = 0) {
  const url = canonicalUrl(link.url);
  const localFindings = [...new Map((link.findings || []).map((finding) => [finding.type, finding])).values()];
  const findings = localFindings.map((finding, index) => {
    const weight = finding.informational ? 0 : ({ high: 45, medium: 15, low: 5 }[finding.severity] || 0);
    return {
      id: `url-${linkIndex}-${index}`,
      category: finding.type,
      severity: finding.informational ? "low" : finding.severity,
      weight,
      scoringGroup: `url:${url}`,
      informational: Boolean(finding.informational),
      reason: finding.reason,
    };
  });
  const reputation = link.reputation?.state === "success" ? link.reputation.data : null;

  if (reputation?.status === "malicious_detections" && Number(reputation.detections?.malicious) > 0) {
    findings.push({
      id: `vt-malicious-${linkIndex}`,
      category: "Malicious URL reputation",
      severity: "high",
      weight: 80,
      scoringGroup: `url:${url}`,
      reason: `VirusTotal reports ${reputation.detections.malicious} malicious detection(s) for this URL. Treat it as unsafe and do not open it.`,
    });
  } else if (reputation?.status === "suspicious_detections" && Number(reputation.detections?.suspicious) > 0) {
    findings.push({
      id: `vt-suspicious-${linkIndex}`,
      category: "Suspicious URL reputation",
      severity: "medium",
      weight: 35,
      scoringGroup: `url:${url}`,
      reason: `VirusTotal reports ${reputation.detections.suspicious} suspicious detection(s) for this URL. Verify it independently before proceeding.`,
    });
  }

  return findings;
}

function senderDomainFinding(emailResults, links) {
  const emailDomain = emailResults?.domain;
  if (!emailDomain || freeEmailDomains.includes(emailDomain)) return null;
  const destination = links.map((link) => {
    try { return new URL(canonicalUrl(link.url)).hostname.toLowerCase(); } catch { return ""; }
  }).find((host) => host && ![...shortenerDomains, ...thirdPartyFormDomains].some((domain) => host === domain || host.endsWith(`.${domain}`)));
  if (!destination || rootDomain(destination) === rootDomain(emailDomain)) return null;
  return {
    id: "sender-link-domain-mismatch",
    category: "Sender and link domains differ",
    severity: "medium",
    weight: 18,
    scoringGroup: "sender-domain-consistency",
    reason: "The sender's company domain differs from the linked website. This may be legitimate, but verify both using contact details found independently.",
  };
}

function unavailableReputationFinding(link, index) {
  const reputation = link.reputation;
  if (!reputation || reputation.state === "loading") return {
    id: `vt-unavailable-${index}`,
    category: "VirusTotal check unavailable",
    severity: "low",
    weight: 0,
    informational: true,
    reason: "The VirusTotal check is not complete. This URL has not been classified as safe or malicious.",
  };
  if (reputation.state === "error" || reputation.state === "skipped") return {
    id: `vt-unavailable-${index}`,
    category: "VirusTotal check unavailable",
    severity: "low",
    weight: 0,
    informational: true,
    reason: reputation.state === "skipped" ? "This URL was not checked because the per-analysis lookup limit was reached." : "VirusTotal could not provide a verdict. This URL has not been classified as safe or malicious.",
  };
  const status = reputation.data?.status;
  if (status === "no_data") return {
    id: `vt-no-report-${index}`,
    category: "No VirusTotal report available",
    severity: "low",
    weight: 0,
    informational: true,
    reason: "No existing VirusTotal report is available. This does not mean the URL is safe.",
  };
  if (["pending", "inconclusive"].includes(status)) return {
    id: `vt-pending-${index}`,
    category: "VirusTotal verdict unavailable",
    severity: "low",
    weight: 0,
    informational: true,
    reason: status === "pending" ? "VirusTotal analysis is pending, so no verdict is available." : "The VirusTotal report has no usable verdicts.",
  };
  return null;
}

export function buildRiskAssessment(messageResults, emailResults, links = []) {
  const uniqueLinks = [...new Map(links.map((link) => [canonicalUrl(link.url), link])).values()];
  const emailFindings = (emailResults?.findings || []).map((finding, index) => ({
    id: `email-${index}-${finding.title}`,
    category: finding.title,
    severity: finding.severity,
    weight: finding.weight || 0,
    scoringGroup: "sender-domain-consistency",
    reason: finding.reason,
  }));
  const findings = [
    ...(messageResults?.findings || []),
    ...emailFindings,
    ...(senderDomainFinding(emailResults, uniqueLinks) ? [senderDomainFinding(emailResults, uniqueLinks)] : []),
    ...uniqueLinks.flatMap(scoreUrl),
    ...uniqueLinks.map(unavailableReputationFinding).filter(Boolean),
  ];
  const overallScore = combineWeightedEvidence(findings);
  const urlChecksIncomplete = uniqueLinks.some((link) => {
    const state = link.reputation?.state;
    const status = link.reputation?.data?.status;
    return state !== "success" || ["no_data", "pending", "inconclusive"].includes(status);
  });

  return {
    overallScore,
    level: riskBand(overallScore),
    urlChecks: links,
    urlChecksIncomplete,
    findings,
  };
}

export function createSavedAnalysisPayload(assessment, recommendations, hostname) {
  return {
    type: "offer",
    score: assessment.overallScore,
    level: assessment.level.id === "low" ? "lower" : assessment.level.id === "very_high" ? "very-high" : assessment.level.id === "high" ? "elevated" : "moderate",
    findings: assessment.findings.slice(0, 30).map(({ evidence: _evidence, scoringGroup: _scoringGroup, informational: _informational, ...finding }) => ({ ...finding, severity: finding.severity === "info" ? "low" : finding.severity })),
    recommendations,
    metadata: hostname ? { hostname } : {},
  };
}

export { scoreUrl };
