const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const conversationRoutes = require('./routes/conversations');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);

// Use a whitelist to restrict CORS access
const whitelist = ['http://localhost:3000'];
const corsOptions = {
    origin: function (origin, callback) {
        if (whitelist.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};

app.use(cors(corsOptions));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB...', err));

// Define the socket.io server
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// A set to keep track of online user IDs
let onlineUsers = new Set();
let userSocketMap = new Map();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join a conversation room
    socket.on('join', (conversationId) => {
        socket.join(conversationId);
    });

    // Handle new messages
    socket.on('message:send', async (msg) => {
        try {
            const conversationId = msg.conversationId;
            const newMessage = new (require('./models/Message'))({
                conversationId: conversationId,
                senderId: msg.senderId,
                content: msg.content
            });
            await newMessage.save();

            const senderUser = await User.findById(msg.senderId);
            const messageWithUsername = {
                ...newMessage.toObject(),
                senderUsername: senderUser.username
            };
            io.to(conversationId).emit('message:new', messageWithUsername);
        } catch (err) {
            console.error('Error sending message:', err);
        }
    });

    // Handle typing status
    socket.on('typing:start', ({ conversationId, username }) => {
        socket.to(conversationId).emit('typing:start', username);
    });

    socket.on('typing:stop', ({ conversationId }) => {
        socket.to(conversationId).emit('typing:stop', "");
    });

    // --- Critical changes for online status ---
    // Listen for 'login' events from the client
    socket.on('login', async (userId) => {
        if (userId) {
            onlineUsers.add(userId);
            userSocketMap.set(userId, socket.id); // Map user ID to socket ID
            io.emit('user:online', userId); // Announce that the user is now online
            // Update the user's online status in the database
            await User.findByIdAndUpdate(userId, { online: true });
        }
    });

    // Listen for disconnections and automatically handle status
    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);
        // Find the user ID by their socket ID
        let userId = null;
        for (let [key, value] of userSocketMap.entries()) {
            if (value === socket.id) {
                userId = key;
                break;
            }
        }
        if (userId) {
            onlineUsers.delete(userId);
            userSocketMap.delete(userId); // Remove from the map
            io.emit('user:offline', userId); // Announce that the user is now offline
            // Update the user's online status in the database
            await User.findByIdAndUpdate(userId, { online: false });
        }
    });

    // Handle initial online users request
    socket.on('getOnlineUsers', () => {
        socket.emit('onlineUsers', Array.from(onlineUsers));
    });
});

// Use API routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/messages', messageRoutes);
app.use('/conversations', conversationRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
