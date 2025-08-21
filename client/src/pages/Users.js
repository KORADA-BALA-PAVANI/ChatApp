import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import socket from "../socket";

// This component displays the list of all registered users
function Users() {
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});
  const navigate = useNavigate();
  const currentUserId = localStorage.getItem("userId");
  const username = localStorage.getItem("username");

  // Fetch all users and set up socket listeners
  useEffect(() => {
    // Fetch all registered users from the server
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("http://localhost:5000/users", {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Filter out the current logged-in user from the list
        const otherUsers = res.data.filter(u => u._id !== currentUserId);
        setUsers(otherUsers);
      } catch (err) {
        console.error("Failed to fetch users:", err);
      }
    };
    fetchUsers();

    // Listen for real-time online status updates via Socket.IO
    socket.on('user:online', (userId) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: true }));
    });
    
    socket.on('user:offline', (userId) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: false }));
    });

    // Request the initial online status of all users from the server
    socket.emit('getOnlineUsers');
    socket.on('onlineUsers', (onlineIds) => {
      const statusMap = {};
      onlineIds.forEach(id => statusMap[id] = true);
      setOnlineUsers(statusMap);
    });

    // Clean up socket listeners when the component unmounts
    return () => {
      socket.off('user:online');
      socket.off('user:offline');
      socket.off('onlineUsers');
    };
  }, [currentUserId]);

  // Function to create or find a conversation and navigate to the chat screen
  const handleStartChat = async (recipientId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post("http://localhost:5000/conversations", 
        { recipientId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Navigate to the chat page with the new or existing conversation ID
      navigate(`/chat/${res.data.conversationId}`);
    } catch (err) {
      console.error("Failed to start chat:", err);
    }
  };

  // Function to handle user logout
  const handleLogout = () => {
    socket.emit('logout', currentUserId);
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="flex flex-col items-center p-6 bg-gray-100 min-h-screen">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-green-600 mb-6">Registered Users</h2>
        <p className="text-sm text-gray-500 text-center mb-4">
          Logged in as: <span className="font-semibold">{username}</span>
        </p>
        <button
          onClick={handleLogout}
          className="w-full bg-green-500 text-white p-2 rounded-full hover:bg-green-600 transition-colors duration-200 font-semibold mb-6 shadow-md"
        >
          Logout
        </button>
        <ul className="space-y-4">
          {users.length > 0 ? (
            users.map(u => (
              // The entire list item is now a clickable element
              <li
                key={u._id}
                onClick={() => handleStartChat(u._id)} // Click handler to start chat
                className="flex items-center p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors duration-200 cursor-pointer shadow-sm active:bg-green-100 active:ring-2 active:ring-green-500"
              >
                <div className="flex-1">
                  <p className="text-lg font-semibold text-gray-800">{u.username}</p>
                  <p className="text-sm text-gray-500">{u.email}</p>
                </div>
                <div className={`w-3 h-3 rounded-full ${onlineUsers[u._id] ? "bg-green-500" : "bg-red-500"}`}></div>
                <span className="ml-2 text-sm text-gray-500">
                  {onlineUsers[u._id] ? "Online" : "Offline"}
                </span>
              </li>
            ))
          ) : (
            <p className="text-center text-gray-500 italic">No other users registered.</p>
          )}
        </ul>
      </div>
    </div>
  );
}

export default Users;
