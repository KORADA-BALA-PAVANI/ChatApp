import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../socket";
import axios from "axios";

// This component handles the chat interface for a specific conversation
function Chat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typingUser, setTypingUser] = useState("");
  const chatEndRef = useRef(null);

  const userId = localStorage.getItem("userId");
  const username = localStorage.getItem("username");

  // Fetch initial messages for the conversation
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`http://localhost:5000/messages/${conversationId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessages(res.data);
      } catch (err) {
        console.error("Failed to fetch messages:", err);
      }
    };
    fetchMessages();
  }, [conversationId]);

  // Handle socket events for real-time updates
  useEffect(() => {
    // Join the specific conversation room
    socket.emit("join", conversationId);

    // Listener for new messages
    socket.on("message:new", (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    // Listener for typing start event
    socket.on("typing:start", (name) => setTypingUser(name));

    // Listener for typing stop event
    socket.on("typing:stop", () => setTypingUser(""));

    // Cleanup function to prevent multiple listeners
    return () => {
      socket.off("message:new");
      socket.off("typing:start");
      socket.off("typing:stop");
    };
  }, [conversationId]);

  // Auto-scroll to the bottom of the chat box when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Typing indicator logic with a timeout
  let typingTimeout;
  const handleTyping = (e) => {
    setInput(e.target.value);
    socket.emit("typing:start", { conversationId, username });
    
    // Clear the previous timeout to reset the timer
    clearTimeout(typingTimeout);
    
    // Set a new timeout to stop typing after 1 second of inactivity
    typingTimeout = setTimeout(() => {
      socket.emit("typing:stop", { conversationId });
    }, 1000);
  };

  // Function to send a message
  const sendMessage = async () => {
    if (!input.trim()) return;
    const msgObj = { conversationId, senderId: userId, content: input };
    socket.emit("message:send", msgObj);
    setInput("");
    clearTimeout(typingTimeout); // Stop typing immediately on send
    socket.emit("typing:stop", { conversationId });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white p-4 shadow-md flex justify-between items-center rounded-b-xl">
        <button onClick={() => navigate("/users")} className="text-gray-600 hover:text-gray-800 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          Chat
        </h1>
        <div></div> {/* Spacer for alignment */}
      </div>

      {/* Chat messages display area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.senderId === userId ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs md:max-w-md p-3 rounded-xl shadow-md ${
                msg.senderId === userId
                  ? "bg-green-500 text-white rounded-br-none"
                  : "bg-white text-gray-800 rounded-bl-none"
              }`}
            >
              <div className="font-semibold text-xs mb-1">
                {msg.senderId === userId ? "You" : msg.senderUsername}
              </div>
              <div>{msg.content}</div>
              <div className="text-right text-xs mt-1 opacity-70">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {/* Typing indicator */}
        {typingUser && (
          <div className="text-gray-500 text-sm italic animate-pulse">
            {typingUser} is typing...
          </div>
        )}
        <div ref={chatEndRef}></div>
      </div>

      {/* Message input and send button area */}
      <div className="p-4 bg-white rounded-t-xl shadow-inner">
        <div className="flex items-center space-x-2">
          <input
            value={input}
            onChange={handleTyping}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-200"
          />
          <button
            onClick={sendMessage}
            className="bg-green-600 text-white p-3 rounded-full hover:bg-green-700 transition-colors duration-200 font-semibold shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;
