require("dotenv").config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

// Import models
const User = require('./models/User');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const conversationRoutes = require('./routes/conversations'); // New conversation route

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch((err) => console.log('❌ MongoDB connection error:', err));

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/messages', messageRoutes);
app.use('/conversations', conversationRoutes); // Use the new conversations route

// Socket.IO server setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// A map to keep track of logged-in users and their socket IDs
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // Handle user login and mark them as online
  socket.on('login', async (userId) => {
    onlineUsers.set(userId, socket.id);
    await User.findByIdAndUpdate(userId, { online: true });
    io.emit('user:online', userId); // Notify all clients
    console.log(`User ${userId} logged in and is online.`);
  });

  // Handle get initial online users
  socket.on('getOnlineUsers', () => {
    const onlineIds = Array.from(onlineUsers.keys());
    socket.emit('onlineUsers', onlineIds);
  });

  // Handle user logout and mark them as offline
  socket.on('logout', async (userId) => {
    onlineUsers.delete(userId);
    await User.findByIdAndUpdate(userId, { online: false });
    io.emit('user:offline', userId); // Notify all clients
    console.log(`User ${userId} logged out and is offline.`);
  });

  // Join a specific conversation room
  socket.on('join', (conversationId) => {
    socket.join(conversationId);
    console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
  });

  // Handle incoming messages
  socket.on('message:send', async ({ conversationId, senderId, content }) => {
    if (!conversationId || !senderId || !content) return;

    try {
      // Find the user to get their username for the client-side display
      const sender = await User.findById(senderId);
      if (!sender) {
        console.log("Sender not found for ID:", senderId);
        return;
      }

      // Create a new message and save it to the database
      const message = await Message.create({ 
        conversationId, 
        senderId, 
        content,
        senderUsername: sender.username // Add username to message for client
      });

      // Update the last message in the conversation
      await Conversation.findByIdAndUpdate(conversationId, { lastMessage: content });

      // Emit the new message to all clients in the conversation room
      io.to(conversationId).emit('message:new', message);
    } catch (err) {
      console.error('❌ Error sending message:', err.message);
    }
  });

  // Handle typing indicator start
  socket.on('typing:start', ({ conversationId, username }) => {
    socket.to(conversationId).emit('typing:start', username);
  });

  // Handle typing indicator stop
  socket.on('typing:stop', ({ conversationId }) => {
    socket.to(conversationId).emit('typing:stop');
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    console.log('❌ User disconnected:', socket.id);
    // Find the user associated with this socket and mark them offline
    const userId = Array.from(onlineUsers.entries()).find(([key, val]) => val === socket.id)?.[0];
    if (userId) {
      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { online: false });
      io.emit('user:offline', userId);
      console.log(`User ${userId} disconnected.`);
    }
  });
});

// Start the server
server.listen(process.env.PORT || 5000, () => console.log(`🚀 Server running on port ${process.env.PORT || 5000}`));
