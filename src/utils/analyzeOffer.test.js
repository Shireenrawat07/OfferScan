import test from "node:test";
import assert from "node:assert/strict";
import analyzeOffer, { extractLinks } from "./analyzeOffer.js";
import unsolicitedInternship from "./fixtures/unsolicitedInternship.js";

test("sanitized unsolicited internship fixture detects selection, urgency, and vague benefits", () => {
  const result = analyzeOffer(unsolicitedInternship);
  const categories = result.findings.map((finding) => finding.category);

  assert.ok(categories.includes("Unsolicited selection claim"));
  assert.ok(categories.includes("Urgent registration deadline"));
  assert.ok(!categories.includes("Unsubstantiated internship benefits"));
  assert.equal(result.findings.find((finding) => finding.id === "urgent-registration").weight, 15);
  assert.ok(result.score > 0 && result.score <= 100);
  assert.deepEqual(extractLinks(unsolicitedInternship), ["https://forms.gle/exampleForm"]);
});

test("shortlisting alone is a verification warning, not a fraud verdict", () => {
  const unsure = analyzeOffer("You have been shortlisted for our internship.");
  assert.equal(unsure.score, 8);
  assert.equal(unsure.findings[0].severity, "low");

  assert.equal(unsure.findings[0].weight, 8);
});

test("ordinary internship benefits and a future deadline are not labeled as a scam", () => {
  const result = analyzeOffer("Following your application, you have been shortlisted for an interview. The internship includes a stipend, a certificate, and a registration deadline next month.");
  assert.ok(result.score <= 19);
  assert.ok(!result.findings.some((finding) => finding.id === "vague-internship-benefits"));
  assert.ok(!result.findings.some((finding) => finding.id === "expired-deadline"));
});

test("upfront payment and expired dates increase risk while future dates do not", () => {
  const payment = analyzeOffer("Pay a security deposit to secure the job.");
  assert.ok(payment.score >= 20);
  assert.ok(payment.findings.some((finding) => finding.category === "Payment request"));

  const expired = analyzeOffer("Application deadline: 2020-01-15.");
  assert.ok(expired.score >= 20);
  assert.ok(expired.findings.some((finding) => finding.category === "Expired deadline"));
  assert.ok(analyzeOffer("Deadline: October 15, 2020.").findings.some((finding) => finding.category === "Expired deadline"));

  const future = analyzeOffer("Application deadline: 2099-01-15.");
  assert.ok(!future.findings.some((finding) => finding.category === "Expired deadline"));
});

test("a normal future registration date does not create urgency risk, and overlapping payment rules count once", () => {
  const future = analyzeOffer("You may register by 2099-01-15 if interested.");
  assert.equal(future.score, 0);

  const overlap = analyzeOffer("Pay the registration fee today. Pay immediately to reserve your interview.");
  assert.equal(overlap.score, 30);
  assert.equal(overlap.findings.filter((finding) => finding.scoringGroup === "payment-demand").length, 2);
});

test("installing remote access software is a risky instruction", () => {
  const result = analyzeOffer("Install AnyDesk before your interview.");
  assert.ok(result.findings.some((finding) => finding.category === "Risky software instruction"));
  assert.ok(result.score >= 20);
  assert.ok(!analyzeOffer("Do not install AnyDesk.").findings.some((finding) => finding.id === "dangerous-software"));
});

test("the analyzer requires no application or organization context", () => {
  const result = analyzeOffer("You have been shortlisted for the internship.");
  assert.ok(result.findings.some((finding) => finding.id === "selection-claim"));
  assert.equal(result.score, 8);
});

test("repeating warning phrases does not add duplicate rule points", () => {
  const once = analyzeOffer("Register now to secure your place.");
  const repeated = analyzeOffer("Register now to secure your place. Register now today. Register immediately.");
  assert.equal(once.findings.find((finding) => finding.id === "urgent-registration").weight, 15);
  assert.equal(repeated.findings.filter((finding) => finding.id === "urgent-registration").length, 1);
  assert.equal(repeated.findings.find((finding) => finding.id === "urgent-registration").weight, 15);
});

test("sensitive information and upfront recruitment charges receive distinct warnings", () => {
  const result = analyzeOffer("Pay an upfront fee for registration. Send your OTP and bank account details.");
  assert.ok(result.findings.some((finding) => finding.category === "Payment request"));
  assert.ok(result.findings.some((finding) => finding.category === "Sensitive information"));
});

test("denied payment requests, safety advice, and negated selection claims are not flagged", () => {
  const result = analyzeOffer("We do not charge an upfront fee. Never share your OTP. You were not shortlisted.");
  assert.equal(result.score, 0);
  assert.equal(result.findings.length, 0);
});

