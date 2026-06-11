import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001", {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket(branchId: string) {
  const s = getSocket();
  if (!s.connected) s.connect();
  s.emit("join-branch", branchId);
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}
