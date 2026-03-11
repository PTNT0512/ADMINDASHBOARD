import { io } from 'socket.io-client';

const socketMap = new Map();

const normalizeBaseUrl = (baseUrl) => {
  return String(baseUrl || 'http://localhost:4001').trim().replace(/\/+$/, '');
};

export const getSharedGameSocket = (baseUrl) => {
  const normalized = normalizeBaseUrl(baseUrl);
  const existing = socketMap.get(normalized);
  if (existing) {
    if (!existing.connected && typeof existing.connect === 'function') {
      existing.connect();
    }
    return existing;
  }

  const socket = io(normalized, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    timeout: 8000,
    autoConnect: true,
  });

  socketMap.set(normalized, socket);
  return socket;
};

export const emitWithAck = (socket, eventName, payload, timeoutMs = 3500) => {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Socket unavailable'));
      return;
    }

    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error(`Socket ACK timeout for ${eventName}`));
    }, Math.max(500, Number(timeoutMs) || 3500));

    try {
      socket.emit(eventName, payload, (response) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(response);
      });
    } catch (error) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(error);
    }
  });
};
