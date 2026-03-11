import io from 'socket.io-client';
import { getDashboardSocketBaseUrl } from '../utils/runtime-endpoints';
import { normalizePayload } from '../utils/mojibake';

const SOCKET_URL = getDashboardSocketBaseUrl();

let socket;

const attachIncomingNormalization = (instance) => {
  if (!instance || instance.__mojibakeNormalized) return instance;

  const originalOnevent = instance.onevent;
  instance.onevent = function patchedOnevent(packet) {
    if (packet && Array.isArray(packet.data)) {
      packet.data = packet.data.map((item) => normalizePayload(item));
    }
    return originalOnevent.call(this, packet);
  };

  instance.__mojibakeNormalized = true;
  return instance;
};

export function getSocket() {
  if (!socket) {
    socket = attachIncomingNormalization(io(SOCKET_URL, { transports: ['websocket'] }));
  }
  return socket;
}
