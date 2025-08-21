import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import socket from "../socket";

// This component handles new user registration
function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await axios.post("http://localhost:5000/auth/register", { username, email, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("userId", res.data.user._id);
      localStorage.setItem("username", res.data.user.username);
      
      // Emit 'login' event to the server to mark user as online
      socket.emit('login', res.data.user._id);

      navigate("/users");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-200">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm">
        <h2 className="text-3xl font-bold text-center text-green-600 mb-6">Register</h2>
        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            className="w-full p-3 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full p-3 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full p-3 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button type="submit" className="w-full bg-green-600 text-white p-3 rounded-full hover:bg-green-700 transition-colors duration-200 font-semibold shadow-md">
            Register
          </button>
        </form>
        {error && <div className="mt-4 text-center text-red-500 text-sm">{error}</div>}
        <p className="text-center text-gray-500 text-sm mt-4">
          Already have an account? <Link to="/" className="text-green-600 hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
