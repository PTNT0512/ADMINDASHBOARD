// Simple socket.io client for dashboard panels
import io from 'socket.io-client';

// You can change this URL to your backend API host if needed

const SOCKET_URL = window.SOCKET_API_URL || 'http://localhost:4001';

let socket;
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, { transports: ['websocket'] });
  }
  return socket;
}
