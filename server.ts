import { createServer } from "node:http";
import next from "next";
import { createClient } from "redis";
import { Server as SocketIOServer } from "socket.io";
import {
  teamChatSocketRoom,
  verifyTeamChatSocketToken,
} from "./src/lib/chat/realtime";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);

const getRedisUrl = () => {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required to run the chat socket server.");
  }

  return process.env.REDIS_URL;
};

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const httpServer = createServer((req, res) => {
    void handle(req, res);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/team-chat/socket",
    cors: {
      origin: true,
      credentials: true,
    },
  });

  const subscriber = createClient({ url: getRedisUrl() });
  subscriber.on("error", (error) => {
    console.error("Redis subscriber error:", error);
  });
  await subscriber.connect();
  await subscriber.pSubscribe("trip:*:chat", (message, channel) => {
    try {
      const payload = JSON.parse(message) as {
        tripId?: string;
        event?: string;
        data?: unknown;
      };
      const parts = channel.split(":");
      const tripId = payload.tripId ?? parts[1];
      if (!tripId) return;

      io.to(teamChatSocketRoom(tripId)).emit(
        payload.event ?? "chat.message.created",
        payload.data ?? payload,
      );
    } catch (error) {
      console.error("Failed to fan out Redis message:", error);
    }
  });

  io.use((socket, nextSocket) => {
    const token =
      typeof socket.handshake.auth?.token === "string"
        ? socket.handshake.auth.token
        : null;

    if (!token) {
      nextSocket(new Error("Unauthorized"));
      return;
    }

    const payload = verifyTeamChatSocketToken(token);
    if (!payload) {
      nextSocket(new Error("Unauthorized"));
      return;
    }

    socket.data.tripId = payload.tripId;
    socket.data.userId = payload.userId;
    nextSocket();
  });

  io.on("connection", (socket) => {
    const tripId = socket.data.tripId as string | undefined;
    if (!tripId) {
      socket.disconnect(true);
      return;
    }

    socket.join(teamChatSocketRoom(tripId));
    socket.emit("chat.ready", { tripId });
  });

  httpServer.listen(port, hostname, () => {
    console.log(
      `> Ready on http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${port}`,
    );
    console.log(`> Team chat sockets attached at /team-chat/socket`);
  });

  const shutdown = async () => {
    io.close();
    await subscriber.quit();
    httpServer.close((error) => {
      if (error) {
        console.error("Failed to close HTTP server cleanly:", error);
      }
      process.exit(error ? 1 : 0);
    });
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void main();
