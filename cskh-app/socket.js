import { io } from 'socket.io-client';

// Resolve API URL from Vite env (import.meta.env) or process env as fallback, then default to localhost
const URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
    || (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL)
    || 'http://localhost:4001';

export const socket = io(URL, {
        autoConnect: true,
        reconnection: true,
        transports: ['websocket']
});