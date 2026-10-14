const mongoose = require("mongoose");

const findingSchema = new mongoose.Schema({
  id: { type: String, maxlength: 80 },
  category: { type: String, required: true, maxlength: 120 },
  severity: { type: String, enum: ["low", "medium", "high"], required: true },
  weight: { type: Number, min: 0, max: 100, default: 0 },
  matchedPhrase: { type: String, maxlength: 120 },
  matchedPhrases: [{ type: String, maxlength: 120 }],
  reason: { type: String, required: true, maxlength: 500 },
}, { _id: false });

const analysisSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["offer", "email", "url"], required: true },
  score: { type: Number, min: 0, max: 100, required: true },
  level: { type: String, enum: ["lower", "moderate", "elevated", "very-high", "needs-review", "no-basic-warning", "invalid"], required: true },
  findings: { type: [findingSchema], default: [] },
  recommendations: { type: [{ type: String, maxlength: 300 }], default: [] },
  metadata: {
    hostname: { type: String, maxlength: 253 },
    domain: { type: String, maxlength: 253 },
  },
}, { timestamps: true });

analysisSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Analysis", analysisSchema);
