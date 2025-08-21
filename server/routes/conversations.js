// server/routes/conversations.js
const express = require("express");
const Conversation = require("../models/Conversation");
const auth = require("../middleware/auth"); // Import the auth middleware

const router = express.Router();

// Create or get a conversation between two users
router.post("/", auth, async (req, res) => {
  const { recipientId } = req.body;
  const senderId = req.user.id;

  try {
    // Find an existing conversation with these two members
    const conversation = await Conversation.findOne({
      members: { $all: [senderId, recipientId] }
    });

    if (conversation) {
      // If found, return the existing conversation's ID
      return res.json({ conversationId: conversation._id });
    }

    // If not found, create a new conversation
    const newConversation = new Conversation({
      members: [senderId, recipientId]
    });
    await newConversation.save();
    res.status(201).json({ conversationId: newConversation._id });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
