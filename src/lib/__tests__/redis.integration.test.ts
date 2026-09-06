// @ts-nocheck -- Bun's test globals are intentionally outside the app tsconfig.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient } from "redis";
import { getRedisClient, redisCacheService } from "../redis";
import {
  teamChatRedisChannel,
  teamChatRedisSubscriptionPattern,
} from "../redis-namespace";

const redisUrl = process.env.REDIS_TEST_URL;
const integrationTest = redisUrl ? test : test.skip;
const testKeys = [
  "plantain:test:alpha:shared-key",
  "plantain:test:beta:shared-key",
  "shared-key",
];
let observer: ReturnType<typeof createClient> | null = null;

beforeAll(async () => {
  if (!redisUrl) return;

  process.env.REDIS_URL = redisUrl;
  observer = createClient({ url: redisUrl });
  await observer.connect();
  await observer.del(testKeys);
});

afterAll(async () => {
  if (!redisUrl) return;

  await observer?.del(testKeys);
  const appClient = await getRedisClient();
  await appClient.quit();
  await observer?.quit();
});

describe("Redis isolation", () => {
  integrationTest(
    "stores cache values under the application namespace",
    async () => {
      process.env.REDIS_NAMESPACE = "plantain:test:alpha";

      await redisCacheService.set("shared-key", "alpha");

      expect(await observer?.get("plantain:test:alpha:shared-key")).toBe(
        "alpha",
      );
      expect(await observer?.get("shared-key")).toBeNull();
    },
  );

  integrationTest(
    "keeps the same cache key isolated by namespace",
    async () => {
      process.env.REDIS_NAMESPACE = "plantain:test:alpha";
      await redisCacheService.set("shared-key", "alpha");

      process.env.REDIS_NAMESPACE = "plantain:test:beta";
      await redisCacheService.set("shared-key", "beta");

      process.env.REDIS_NAMESPACE = "plantain:test:alpha";
      expect(await redisCacheService.get("shared-key")).toBe("alpha");

      process.env.REDIS_NAMESPACE = "plantain:test:beta";
      expect(await redisCacheService.get("shared-key")).toBe("beta");
    },
  );

  integrationTest(
    "deletes a cache key only from the active namespace",
    async () => {
      process.env.REDIS_NAMESPACE = "plantain:test:alpha";
      await redisCacheService.set("shared-key", "alpha");

      process.env.REDIS_NAMESPACE = "plantain:test:beta";
      await redisCacheService.set("shared-key", "beta");

      process.env.REDIS_NAMESPACE = "plantain:test:alpha";
      await redisCacheService.del("shared-key");
      expect(await redisCacheService.get("shared-key")).toBeNull();

      process.env.REDIS_NAMESPACE = "plantain:test:beta";
      expect(await redisCacheService.get("shared-key")).toBe("beta");
    },
  );

  integrationTest(
    "delivers pubsub messages only within one namespace",
    async () => {
      const subscriber = createClient({ url: redisUrl });
      await subscriber.connect();

      let resolveReceived!: (value: {
        message: string;
        channel: string;
      }) => void;
      const received = new Promise<{ message: string; channel: string }>(
        (resolve) => {
          resolveReceived = resolve;
        },
      );
      await subscriber.pSubscribe(
        teamChatRedisSubscriptionPattern("plantain:test:alpha"),
        (message, channel) => resolveReceived({ message, channel }),
      );

      try {
        expect(
          await observer?.publish(
            teamChatRedisChannel("trip_42", "plantain:test:beta"),
            "beta-message",
          ),
        ).toBe(0);
        expect(
          await observer?.publish(
            teamChatRedisChannel("trip_42", "plantain:test:alpha"),
            "alpha-message",
          ),
        ).toBe(1);
        expect(await received).toEqual({
          message: "alpha-message",
          channel: "plantain:test:alpha:trip:trip_42:chat",
        });
      } finally {
        await subscriber.quit();
      }
    },
  );
});
