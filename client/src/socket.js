// socket.js
import { io } from "socket.io-client";

// connect to backend server
const socket = io("http://localhost:5000"); // server port
export default socket;
