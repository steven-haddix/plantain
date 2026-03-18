import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "redis";

type SocketTokenPayload = {
  tripId: string;
  userId: string;
  expiresAt: number;
};

const TOKEN_TTL_MS = 1000 * 60 * 5;
let publishClientPromise: Promise<ReturnType<typeof createClient>> | null =
  null;

const getSocketSecret = () => {
  const secret = process.env.CHAT_SOCKET_SECRET;
  if (!secret) {
    throw new Error("CHAT_SOCKET_SECRET is not configured.");
  }
  return secret;
};

const getRedisUrl = () => {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not configured.");
  }
  return process.env.REDIS_URL;
};

const base64url = (value: string) => Buffer.from(value).toString("base64url");

const sign = (value: string) =>
  createHmac("sha256", getSocketSecret()).update(value).digest("base64url");

export const teamChatRedisChannel = (tripId: string) => `trip:${tripId}:chat`;
export const teamChatSocketRoom = (tripId: string) => `trip:${tripId}:team`;

export async function publishTeamChatEvent(payload: {
  tripId: string;
  event: "chat.message.created";
  data: unknown;
}) {
  if (!publishClientPromise) {
    const client = createClient({ url: getRedisUrl() });
    client.on("error", (error) => {
      console.error("Redis publish client error:", error);
    });
    publishClientPromise = client.connect().then(() => client);
  }

  const client = await publishClientPromise;
  await client.publish(
    teamChatRedisChannel(payload.tripId),
    JSON.stringify(payload),
  );
}

export function createTeamChatSocketToken(input: {
  tripId: string;
  userId: string;
}) {
  const payload: SocketTokenPayload = {
    tripId: input.tripId,
    userId: input.userId,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };

  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyTeamChatSocketToken(token: string) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SocketTokenPayload;

    if (
      typeof payload.tripId !== "string" ||
      typeof payload.userId !== "string" ||
      typeof payload.expiresAt !== "number"
    ) {
      return null;
    }

    if (payload.expiresAt < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
