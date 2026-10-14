const { VirusTotalError, checkUrlReputation } = require("../services/virusTotal.service");

const MAX_URL_LENGTH = 2048;

const checkLink = async (req, res, next) => {
  const { url } = req.body || {};

  if (typeof url !== "string" || !url.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: "URL_REQUIRED", message: "Provide a URL as a non-empty string." },
    });
  }

  const trimmedUrl = url.trim();

  if (trimmedUrl.length > MAX_URL_LENGTH) {
    return res.status(413).json({
      success: false,
      error: { code: "URL_TOO_LONG", message: `URL must be ${MAX_URL_LENGTH} characters or fewer.` },
    });
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_URL", message: "Provide a correctly formatted absolute URL." },
    });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
    return res.status(400).json({
      success: false,
      error: { code: "UNSUPPORTED_URL", message: "URL must use HTTP or HTTPS and include a hostname." },
    });
  }

  try {
    const reputation = await checkUrlReputation(trimmedUrl);

    return res.status(200).json({
      success: true,
      data: { url: trimmedUrl, ...reputation },
    });
  } catch (error) {
    if (error instanceof VirusTotalError) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
    }

    return next(error);
  }
};

module.exports = { checkLink };
