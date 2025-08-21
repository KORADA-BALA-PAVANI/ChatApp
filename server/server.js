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

// A map to track online users and their corresponding socket IDs
const onlineUsers = new Map();

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
            let senderUsername = "Unknown";

            // Fetch the user's username directly from the database for reliability
            const senderUser = await User.findById(msg.senderId);
            
            // This is the critical change: check if the user and username exist
            if (senderUser && senderUser.username) {
                senderUsername = senderUser.username;
            } else {
                console.error("Error: Sender user or username not found for ID:", msg.senderId);
                // Return early to prevent the validation error
                return;
            }

            const newMessage = new (require('./models/Message'))({
                conversationId: conversationId,
                senderId: msg.senderId,
                content: msg.content,
                senderUsername: senderUsername
            });
            await newMessage.save();

            const messageWithUsername = {
                ...newMessage.toObject(),
                senderUsername: senderUsername
            };
            // Broadcast the new message to all clients in the conversation room
            io.to(conversationId).emit('message:new', messageWithUsername);
        } catch (err) {
            console.error('Error sending message:', err);
        }
    });

    // Handle typing status
    socket.on('typing:start', ({ conversationId, username }) => {
        // Broadcast to everyone in the room except the sender
        socket.to(conversationId).emit('typing:start', username);
    });

    socket.on('typing:stop', ({ conversationId }) => {
        socket.to(conversationId).emit('typing:stop', "");
    });

    // Handle user login (explicitly emitted by client on login/register)
    socket.on('login', async (userId) => {
        if (userId) {
            onlineUsers.set(userId, socket.id);
            // Update the user's online status in the database
            await User.findByIdAndUpdate(userId, { online: true });
            // Broadcast that the user is now online to all clients
            io.emit('user:online', userId);
        }
    });

    // Handle explicit user logout
    socket.on('logout', async (userId) => {
        if (userId && onlineUsers.has(userId)) {
            onlineUsers.delete(userId);
            // Update the user's online status in the database
            await User.findByIdAndUpdate(userId, { online: false });
            // Broadcast that the user is now offline to all clients
            io.emit('user:offline', userId);
        }
    });

    // Handle user disconnection (occurs when a user closes a tab or loses connection)
    socket.on('disconnect', async () => {
        // Find the user ID associated with this socket ID
        let userId = null;
        for (let [key, value] of onlineUsers.entries()) {
            if (value === socket.id) {
                userId = key;
                break;
            }
        }
        if (userId) {
            onlineUsers.delete(userId);
            // Update the user's online status in the database
            await User.findByIdAndUpdate(userId, { online: false });
            // Broadcast that the user is now offline
            io.emit('user:offline', userId);
        }
    });
    
    // Handle initial online users request
    socket.on('getOnlineUsers', () => {
        // Send the list of all online user IDs to the requesting client
        socket.emit('onlineUsers', Array.from(onlineUsers.keys()));
    });
});

// Use API routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/messages', messageRoutes);
app.use('/conversations', conversationRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
