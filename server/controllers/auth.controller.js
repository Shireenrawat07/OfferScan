const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { COOKIE_NAME } = require("../middleware/requireAuth");

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  maxAge: COOKIE_MAX_AGE,
  path: "/api",
});

function setSession(res, user) {
  const token = jwt.sign({ sub: user.id, ver: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

async function register(req, res, next) {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body?.password;
    if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== "string" || password.length < 8 || password.length > 128) {
      return res.status(400).json({ success: false, error: { code: "INVALID_REGISTRATION", message: "Enter a name, valid email, and password between 8 and 128 characters." } });
    }

    const existing = await User.exists({ email });
    if (existing) return res.status(409).json({ success: false, error: { code: "EMAIL_IN_USE", message: "An account with this email already exists." } });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    setSession(res, user);
    return res.status(201).json({ success: true, data: { user: safeUser(user) } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, error: { code: "EMAIL_IN_USE", message: "An account with this email already exists." } });
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body?.password;
    if (!email || typeof password !== "string" || password.length > 128) {
      return res.status(400).json({ success: false, error: { code: "INVALID_LOGIN", message: "Enter your email and password." } });
    }
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." } });
    }
    setSession(res, user);
    return res.json({ success: true, data: { user: safeUser(user) } });
  } catch (error) {
    return next(error);
  }
}

async function currentUser(req, res) {
  return res.json({ success: true, data: { user: safeUser(req.user) } });
}

async function logout(req, res, next) {
  try {
    await req.user.updateOne({ $inc: { tokenVersion: 1 } });
    const clearOptions = { ...cookieOptions() };
    delete clearOptions.maxAge;
    return res.clearCookie(COOKIE_NAME, clearOptions)
      .json({ success: true, data: { message: "You have signed out." } });
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login, currentUser, logout };
