
const shortenerDomains = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "is.gd",
  "cutt.ly",
  "rb.gy",
  "shorturl.at",
];

function analyzeLinks(links) {
  if (!Array.isArray(links)) {
    return [];
  }

  return links.map((originalLink) => {
    const rawLink = originalLink.trim();
    const findings = [];

    let url;

    try {
      const normalizedLink = /^https?:\/\//i.test(rawLink)
        ? rawLink
        : `https://${rawLink}`;

      url = new URL(normalizedLink);
    } catch {
      return {
        url: rawLink,
        level: "elevated",
        findings: [
          {
            type: "Invalid URL",
            severity: "high",
            reason: "This link could not be parsed as a valid URL.",
          },
        ],
      };
    }

    const hostname = url.hostname.toLowerCase();
    const isHttps = url.protocol === "https:";
    const isIpAddress =
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
      hostname.startsWith("[");

    const isShortener = shortenerDomains.some(
      (domain) =>
        hostname === domain || hostname.endsWith(`.${domain}`)
    );

    // A URL should not normally contain embedded login credentials.
    if (url.username || url.password) {
      findings.push({
        type: "Embedded credentials",
        severity: "high",
        reason:
          "This URL contains a username or password component. Avoid opening it until you independently verify the link.",
      });
    }

    if (!isHttps && !isShortener) {
      findings.push({
        type: "No HTTPS",
        severity: "medium",
        reason:
          "This link does not use HTTPS. Its connection may not be encrypted.",
      });
    }

    if (isShortener) {
      findings.push({
        type: "Shortened URL",
        severity: "info",
        informational: true,
        reason: "Shortened link: unable to verify final destination.",
      });
    }

    if (isIpAddress) {
      findings.push({
        type: "IP-address destination",
        severity: "medium",
        reason:
          "This link uses an IP address instead of a conventional domain name. Confirm the destination independently.",
      });
    }

    const suspiciousPathPattern =
      /(?:login|verify|application|recruitment|career|job|account|payment)/i;

    if (!isShortener && suspiciousPathPattern.test(url.pathname)) {
      findings.push({
        type: "Sensitive-action URL path",
        severity: "low",
        reason:
          "The URL path references a login, verification, payment, or job-related action. This is not inherently suspicious, but verify the website before entering information.",
      });
    }

    let level = "lower";

    const scoredFindings = findings.filter((finding) => !finding.informational);
    if (scoredFindings.some((finding) => finding.severity === "high")) {
      level = "elevated";
    } else if (
      scoredFindings.filter((finding) => finding.severity === "medium").length >= 2
    ) {
      level = "elevated";
    } else if (scoredFindings.length > 0) {
      level = "moderate";
    }

    return {
      url: rawLink,
      hostname,
      level,
      findings,
    };
  });
}

export default analyzeLinks;
