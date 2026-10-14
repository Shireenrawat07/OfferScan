const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");
const healthRoutes = require("./routes/health.routes");
const linkRoutes = require("./routes/link.routes");
const authRoutes = require("./routes/auth.routes");
const analysisRoutes = require("./routes/analysis.routes");
const { requestContext, errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("OfferScan backend could not start: JWT_SECRET must be set to a random value of at least 32 characters in server/.env.");
  process.exit(1);
}

const allowedOrigins = new Set([
  ...(process.env.FRONTEND_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  "https://offerscan-4b9ybflrg-shireen10.vercel.app",
]);

app.use(requestContext);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS."));
  },
  credentials: true,
}));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// SameSite cookies block cross-site submission; this origin check adds a second
// guard for browser requests that change account or history data.
app.use((req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ success: false, error: { code: "ORIGIN_NOT_ALLOWED", message: "This request origin is not allowed." } });
  }
  return next();
});

app.use("/api/health", healthRoutes);
app.use("/api/links", linkRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/analysis", analysisRoutes);

// Return safe JSON errors and log only non-sensitive diagnostic metadata.
app.use(errorHandler);

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`OfferScan backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error(`OfferScan backend could not start: ${error.message}`);
    process.exit(1);
  }
}

startServer();
