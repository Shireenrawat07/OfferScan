const { randomUUID } = require("node:crypto");

function requestContext(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}

function safeErrorCode(code) {
  if (Number.isInteger(code)) return code;
  if (typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code)) return code;
  return undefined;
}

function redactDiagnosticText(value, req) {
  let output = String(value || "")
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, "[REDACTED_MONGODB_URI]")
    .replace(/(password|passwd|token|secret|api[_-]?key|authorization|cookie)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1=[REDACTED]")
    .replace(/\b(Bearer|Basic)\s+\S+/gi, "$1 [REDACTED]")
    .replace(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g, "[REDACTED_PASSWORD_HASH]")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[REDACTED_TOKEN]");

  const secrets = [
    process.env.MONGODB_URI,
    process.env.JWT_SECRET,
    process.env.VIRUSTOTAL_API_KEY,
    req.headers?.authorization,
    req.headers?.cookie,
    ...Object.values(req.cookies || {}),
    ...Object.values(req.body || {}).filter((item) => typeof item === "string"),
  ].filter((item) => typeof item === "string" && item.length > 0);

  for (const secret of secrets) {
    output = output.split(secret).join("[REDACTED]");
  }
  return output;
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const requestId = req.requestId || randomUUID();
  const errorName = typeof error?.name === "string" && /^[A-Za-z0-9]{1,60}$/.test(error.name)
    ? error.name
    : "Error";
  const errorCode = safeErrorCode(error?.code);
  const isDatabaseError = ["MongoNetworkError", "MongoServerSelectionError", "MongooseServerSelectionError", "MongoTimeoutError"].includes(errorName);

  // Log a redacted error and stack for diagnosis. Never log request bodies,
  // raw headers/cookies, or unfiltered environment secrets.
  console.error(JSON.stringify({
    event: "request_error",
    requestId,
    method: req.method,
    path: req.path,
    errorName,
    ...(errorCode === undefined ? {} : { errorCode }),
    errorMessage: isDatabaseError ? "Database operation failed." : redactDiagnosticText(error?.message, req).slice(0, 1200),
    ...(!isDatabaseError && error?.stack ? { stack: redactDiagnosticText(error.stack, req).slice(0, 6000) } : {}),
  }));

  let status = 500;
  let code = req.path === "/api/auth/register" ? "REGISTRATION_FAILED" : "INTERNAL_SERVER_ERROR";
  let message = req.path === "/api/auth/register"
    ? "Registration could not be completed right now. Please try again. If it continues, share the reference ID with support."
    : "The request could not be completed right now. Please try again.";

  if (error?.message === "Origin is not allowed by CORS.") {
    status = 403;
    code = "ORIGIN_NOT_ALLOWED";
    message = "This request origin is not allowed.";
  } else if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    status = 400;
    code = "INVALID_JSON";
    message = "Request body must contain valid JSON.";
  } else if (error?.type === "entity.too.large") {
    status = 413;
    code = "BODY_TOO_LARGE";
    message = "Request body is too large.";
  } else if (error?.code === 11000) {
    status = 409;
    code = "EMAIL_IN_USE";
    message = "An account with this email already exists.";
  } else if (errorName === "ValidationError" || errorName === "CastError") {
    status = 400;
    code = "INVALID_ACCOUNT_DATA";
    message = "Some account details are invalid. Check the name, email, and password requirements.";
  } else if (["MongoNetworkError", "MongoServerSelectionError", "MongooseServerSelectionError", "MongoTimeoutError"].includes(errorName)) {
    status = 503;
    code = "DATABASE_UNAVAILABLE";
    message = "OfferLens could not reach the database. Please try again shortly.";
  }

  return res.status(status).json({
    success: false,
    error: { code, message, requestId },
  });
}

module.exports = { requestContext, errorHandler, redactDiagnosticText };
