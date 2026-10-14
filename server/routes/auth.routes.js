const express = require("express");
const rateLimit = require("express-rate-limit");
const { register, login, currentUser, logout } = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, message: { success: false, error: { code: "RATE_LIMITED", message: "Too many sign-in attempts. Please try again later." } } });

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", requireAuth, currentUser);
router.post("/logout", requireAuth, logout);

module.exports = router;
