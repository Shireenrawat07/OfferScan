const express = require("express");
const { checkLink } = require("../controllers/link.controller");

const router = express.Router();

router.post("/check", checkLink);

module.exports = router;
