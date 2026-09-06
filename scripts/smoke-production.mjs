// Run only inside the disposable app container via verify-production.sh.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { Client } from "pg";
import { createClient } from "redis";
import { io } from "socket.io-client";

const origin = "http://127.0.0.1:3000";
const health = await fetch(`${origin}/api/health`);
assert.equal(health.status, 200);
assert.equal(health.headers.get("cache-control"), "no-store");
assert.deepEqual(await health.json(), { status: "ok" });
assert.equal((await fetch(`${origin}/api/trips/unowned/people`)).status, 401);
assert.equal((await fetch(`${origin}/api/auth/get-session`)).status, 200);

const db = new Client(process.env.DATABASE_URL);
await db.connect();
try {
  assert.equal((await db.query("SELECT rolsuper FROM pg_roles WHERE rolname=current_user")).rows[0].rolsuper, false);
  assert.equal(Number((await db.query("SELECT count(*) FROM drizzle.__drizzle_migrations")).rows[0].count), 11);
  assert.equal((await db.query("SELECT ST_Distance(ST_Point(0,0)::geography,ST_Point(0,0)::geography) AS distance, '[1,2,3]'::vector <-> '[1,2,3]'::vector AS vector_distance")).rows[0].distance, 0);
  await db.query("INSERT INTO users(id,email,name) VALUES ('production-rehearsal-user','rehearsal@example.invalid','Rehearsal')");
  await db.query("INSERT INTO sessions(id,user_id,token,expires_at) VALUES ('rehearsal-session','production-rehearsal-user','rehearsal-session-token',now()+interval '1 hour')");
} finally {
  await db.end();
}

// Exercise the real Better Auth adapter/schema using a signed test session.
const sessionToken = "rehearsal-session-token";
const sessionSignature = createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(sessionToken).digest("base64");
const cookie = `better-auth.session_token=${encodeURIComponent(`${sessionToken}.${sessionSignature}`)}`;
const authenticated = await fetch(`${origin}/api/auth/get-session`, { headers: { cookie } });
assert.equal(authenticated.status, 200);
assert.equal((await authenticated.json()).user.id, "production-rehearsal-user");
assert.equal((await fetch(`${origin}/api/trips/unowned/people`, { headers: { cookie } })).status, 404);

const require = createRequire(`${process.cwd()}/package.json`);
const { redisCacheService, getRedisClient } = require("./src/lib/redis.ts");
const namespace = process.env.REDIS_NAMESPACE;
try {
  await redisCacheService.set("rehearsal-key", "first", 60);
  process.env.REDIS_NAMESPACE = "plantain:other-rehearsal";
  assert.equal(await redisCacheService.get("rehearsal-key"), null);
  await redisCacheService.set("rehearsal-key", "second", 60);
  process.env.REDIS_NAMESPACE = namespace;
  assert.equal(await redisCacheService.get("rehearsal-key"), "first");
  await redisCacheService.del("rehearsal-key");
  process.env.REDIS_NAMESPACE = "plantain:other-rehearsal";
  assert.equal(await redisCacheService.get("rehearsal-key"), "second");
  await redisCacheService.del("rehearsal-key");
} finally {
  process.env.REDIS_NAMESPACE = namespace;
  await (await getRedisClient()).quit();
}

function token(tripId, userId) {
  const payload = Buffer.from(JSON.stringify({ tripId, userId, expiresAt: Date.now() + 60_000 })).toString("base64url");
  const signature = createHmac("sha256", process.env.CHAT_SOCKET_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function connect(authToken) {
  return io(origin, { path: "/team-chat/socket", transports: ["websocket"], reconnection: false, auth: { token: authToken } });
}
function event(socket, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${name}`)), 5000);
    socket.once(name, value => { clearTimeout(timer); resolve(value); });
  });
}
const invalid = connect("invalid");
const first = connect(token("rehearsal-trip", "one"));
const second = connect(token("rehearsal-trip", "two"));
const otherTrip = connect(token("other-trip", "three"));
const publisher = createClient({ url: process.env.REDIS_URL });
try {
  const [error] = await Promise.all([event(invalid, "connect_error"), event(first, "chat.ready"), event(second, "chat.ready"), event(otherTrip, "chat.ready")]);
  assert.equal(error.message, "Unauthorized");
  const received = [];
  const unrelated = [];
  first.on("chat.message.created", message => received.push(message));
  otherTrip.on("chat.message.created", message => unrelated.push(message));
  await publisher.connect();
  const message = { tripId: "rehearsal-trip", event: "chat.message.created", data: { id: "expected" } };
  const oneMessage = event(first, "chat.message.created");
  const twoMessage = event(second, "chat.message.created");
  await publisher.publish("another-app:prod:trip:rehearsal-trip:chat", JSON.stringify({ ...message, data: { id: "foreign" } }));
  await publisher.publish(`${process.env.REDIS_NAMESPACE}:trip:rehearsal-trip:chat`, JSON.stringify(message));
  assert.deepEqual(await oneMessage, { id: "expected" });
  assert.deepEqual(await twoMessage, { id: "expected" });
  assert.deepEqual(received, [{ id: "expected" }]);
  assert.deepEqual(unrelated, []);
} finally {
  for (const socket of [invalid, first, second, otherTrip]) socket.close();
  if (publisher.isOpen) await publisher.quit();
}
console.log("Health, signed auth session, access rejection, restricted DB role, 11 migrations, spatial/vector queries, cache isolation, and two-client WebSocket delivery passed.");
