const jwt = require("jsonwebtoken");
const User = require("../models/User");

const COOKIE_NAME = "offerlens_session";

async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ success: false, error: { code: "AUTH_REQUIRED", message: "Please sign in to continue." } });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, error: { code: "SESSION_EXPIRED", message: "Your session has expired. Please sign in again." } });
  }

  try {
    const user = await User.findById(payload.sub).select("name email tokenVersion");
    if (!user || user.tokenVersion !== payload.ver) {
      return res.status(401).json({ success: false, error: { code: "SESSION_EXPIRED", message: "Your session has expired. Please sign in again." } });
    }
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { requireAuth, COOKIE_NAME };
