const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
  members: [{ type: String, required: true }],
  lastMessage: { type: String, default: "" },
});

module.exports = mongoose.model("Conversation", conversationSchema);


