const mongoose = require("mongoose");

const healthCheck = (req, res) => {
  const isDatabaseConnected = mongoose.connection.readyState === 1;

  return res.status(isDatabaseConnected ? 200 : 503).json({
    success: isDatabaseConnected,
    message: "OfferScan backend is running!",
    database: {
      connected: isDatabaseConnected,
    },
  });
};

module.exports = { healthCheck };
