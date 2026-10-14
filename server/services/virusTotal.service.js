const VIRUSTOTAL_URL = "https://www.virustotal.com/api/v3/urls";
const REQUEST_TIMEOUT_MS = 8000;

class VirusTotalError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function getUrlIdentifier(url) {
  // VirusTotal accepts URL-safe Base64 without trailing padding.
  return Buffer.from(url, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function readCount(stats, field) {
  const value = stats[field];
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

async function checkUrlReputation(url) {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;

  if (!apiKey) {
    throw new VirusTotalError(
      503,
      "VIRUSTOTAL_NOT_CONFIGURED",
      "VirusTotal reputation checking is not configured on this server."
    );
  }

  const urlIdentifier = getUrlIdentifier(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(`${VIRUSTOTAL_URL}/${urlIdentifier}`, {
      method: "GET",
      headers: { accept: "application/json", "x-apikey": apiKey },
      signal: controller.signal,
      redirect: "error",
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new VirusTotalError(504, "VIRUSTOTAL_TIMEOUT", "VirusTotal did not respond before the request timed out.");
    }

    throw new VirusTotalError(502, "VIRUSTOTAL_NETWORK_ERROR", "Could not reach VirusTotal. Please try again later.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 404) {
    return {
      available: false,
      status: "no_data",
      message: "VirusTotal has no existing reputation report for this URL.",
      disclaimer: "No report does not mean that a URL is safe.",
    };
  }

  if (response.status === 401 || response.status === 403) {
    throw new VirusTotalError(502, "VIRUSTOTAL_INVALID_API_KEY", "VirusTotal rejected the server API key. Check the backend configuration.");
  }

  if (response.status === 429) {
    throw new VirusTotalError(429, "VIRUSTOTAL_RATE_LIMITED", "VirusTotal's request limit was reached. Please try again later.");
  }

  if (!response.ok) {
    throw new VirusTotalError(502, "VIRUSTOTAL_REQUEST_FAILED", "VirusTotal could not complete the reputation lookup.");
  }

  let report;

  try {
    report = await response.json();
  } catch {
    throw new VirusTotalError(502, "VIRUSTOTAL_INVALID_RESPONSE", "VirusTotal returned an unreadable response.");
  }

  const attributes = report?.data?.attributes;
  if (["queued", "pending", "in-progress"].includes(attributes?.status)) {
    return {
      available: true,
      status: "pending",
      message: "VirusTotal analysis is still pending; no verdict is available yet.",
      disclaimer: "A pending analysis is not a safety verdict.",
    };
  }

  const stats = attributes?.last_analysis_stats;

  if (!stats || typeof stats !== "object") {
    throw new VirusTotalError(502, "VIRUSTOTAL_INVALID_RESPONSE", "VirusTotal returned an unexpected reputation report.");
  }

  const malicious = readCount(stats, "malicious");
  const suspicious = readCount(stats, "suspicious");
  const harmless = readCount(stats, "harmless");
  const undetected = readCount(stats, "undetected");
  let status = "no_threats_detected";

  if (malicious > 0) {
    status = "malicious_detections";
  } else if (suspicious > 0) {
    status = "suspicious_detections";
  } else if (harmless + undetected === 0) {
    status = "inconclusive";
  }

  return {
    available: true,
    status,
    detections: { malicious, suspicious, harmless, undetected },
    lastAnalysisDate: attributes.last_analysis_date || null,
    message:
      status === "malicious_detections"
        ? "VirusTotal reports malicious detections for this URL."
        : status === "suspicious_detections"
          ? "VirusTotal reports suspicious detections for this URL."
          : status === "inconclusive"
            ? "VirusTotal returned a report without usable verdict counts."
            : "No malicious or suspicious detections were reported in the available results.",
    disclaimer: "A reputation report cannot guarantee that a URL is safe.",
  };
}

module.exports = { VirusTotalError, checkUrlReputation };
