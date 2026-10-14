const mongoose = require("mongoose");

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri || !mongoUri.trim()) {
    throw new Error(
      "MONGODB_URI is not set. Add your MongoDB Atlas connection string to server/.env."
    );
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("MongoDB connection established.");
  } catch (error) {
    const reason = error.name || "connection error";
    throw new Error(
      `MongoDB connection failed (${reason}). Check the Atlas URI, database user, and network access settings.`
    );
  }
}

module.exports = connectDB;
