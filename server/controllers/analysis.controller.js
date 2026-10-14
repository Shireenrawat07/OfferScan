const mongoose = require("mongoose");
const Analysis = require("../models/Analysis");

function validateBody(body) {
  const allowed = new Set(["type", "score", "level", "findings", "recommendations", "metadata"]);
  if (!body || Object.keys(body).some((key) => !allowed.has(key))) return "Unexpected analysis fields.";
  if (!["offer", "email", "url"].includes(body.type)) return "Analysis type is invalid.";
  if (!Number.isInteger(body.score) || body.score < 0 || body.score > 100) return "Analysis score must be between 0 and 100.";
  if (!["lower", "moderate", "elevated", "very-high", "needs-review", "no-basic-warning", "invalid"].includes(body.level) || !Array.isArray(body.findings) || body.findings.length > 30 || !Array.isArray(body.recommendations) || body.recommendations.length > 10) return "Analysis results are invalid.";
  const allowedCategories = new Set([
    "Payment request", "Urgent payment", "Unrealistic promise", "Sensitive information", "Equipment purchase",
    "Unsolicited selection claim", "Urgent registration deadline", "Expired deadline", "Risky software instruction",
    "Sender and link domains differ", "No VirusTotal report available", "VirusTotal verdict unavailable", "VirusTotal check unavailable",
    "Unsubstantiated internship benefits", "Organization and domain mismatch",
    "Malicious URL reputation", "Suspicious URL reputation",
    "Embedded credentials", "No HTTPS", "Shortened URL", "IP-address destination", "Sensitive-action URL path", "Invalid URL",
    "Free email provider", "Internationalized domain detected", "Unusual domain pattern", "Invalid email format",
  ]);
  if (body.findings.some((finding) => !finding || typeof finding !== "object" || Array.isArray(finding) || !allowedCategories.has(finding.category) || !["low", "medium", "high"].includes(finding.severity) || typeof finding.reason !== "string" || finding.reason.length > 500)) return "Analysis findings are invalid.";
  if (body.recommendations.some((item) => typeof item !== "string" || item.length > 300)) return "Analysis recommendations are invalid.";
  if (body.metadata !== undefined && (typeof body.metadata !== "object" || body.metadata === null || Array.isArray(body.metadata) || Object.keys(body.metadata).some((key) => !["hostname", "domain"].includes(key)))) return "Analysis metadata is invalid.";
  return null;
}

async function createAnalysis(req, res, next) {
  const problem = validateBody(req.body);
  if (problem) return res.status(400).json({ success: false, error: { code: "INVALID_ANALYSIS", message: problem } });
  try {
    // Evidence quotes can contain the user's entire message, so never persist it.
    const findings = req.body.findings.map((finding) => ({
      id: finding.id,
      category: finding.category,
      severity: finding.severity,
      weight: finding.weight,
      matchedPhrase: finding.matchedPhrase,
      matchedPhrases: finding.matchedPhrases,
      reason: finding.reason,
    }));
    const analysis = await Analysis.create({ ...req.body, findings, user: req.user.id });
    return res.status(201).json({ success: true, data: { analysis } });
  } catch (error) {
    return next(error);
  }
}

async function listAnalyses(req, res, next) {
  const page = Number.parseInt(req.query.page || "1", 10);
  const limit = Number.parseInt(req.query.limit || "10", 10);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    return res.status(400).json({ success: false, error: { code: "INVALID_PAGINATION", message: "Page must be positive and limit must be between 1 and 50." } });
  }
  try {
    const filter = { user: req.user.id };
    const [items, total] = await Promise.all([
      Analysis.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Analysis.countDocuments(filter),
    ]);
    return res.json({ success: true, data: { items, page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    return next(error);
  }
}

async function getAnalysis(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, error: { code: "ANALYSIS_NOT_FOUND", message: "Saved analysis was not found." } });
  try {
    const analysis = await Analysis.findOne({ _id: req.params.id, user: req.user.id }).lean();
    if (!analysis) return res.status(404).json({ success: false, error: { code: "ANALYSIS_NOT_FOUND", message: "Saved analysis was not found." } });
    return res.json({ success: true, data: { analysis } });
  } catch (error) {
    return next(error);
  }
}

async function deleteAnalysis(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, error: { code: "ANALYSIS_NOT_FOUND", message: "Saved analysis was not found." } });
  try {
    const result = await Analysis.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!result) return res.status(404).json({ success: false, error: { code: "ANALYSIS_NOT_FOUND", message: "Saved analysis was not found." } });
    return res.json({ success: true, data: { message: "Saved analysis deleted." } });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createAnalysis, listAnalyses, getAnalysis, deleteAnalysis, validateBody };
