// server/routes/users.js
const express = require("express");
const User = require("../models/User");
const auth = require("../middleware/auth"); // Import the auth middleware

const router = express.Router();

// Get all users (now protected)
router.get("/", auth, async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;