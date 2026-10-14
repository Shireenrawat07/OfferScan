const express = require("express");
const { requireAuth } = require("../middleware/requireAuth");
const { createAnalysis, listAnalyses, getAnalysis, deleteAnalysis } = require("../controllers/analysis.controller");

const router = express.Router();
router.use(requireAuth);
router.route("/").post(createAnalysis).get(listAnalyses);
router.route("/:id").get(getAnalysis).delete(deleteAnalysis);

module.exports = router;
