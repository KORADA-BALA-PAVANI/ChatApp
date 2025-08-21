// server/routes/messages.js
const express = require("express");
const Message = require("../models/Message");
const auth = require("../middleware/auth"); // Import the auth middleware

const router = express.Router();

// Get messages for a conversation
router.get("/:conversationId", auth, async (req, res) => {
  const { conversationId } = req.params;
  const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });
  res.json(messages);
});

module.exports = router;
