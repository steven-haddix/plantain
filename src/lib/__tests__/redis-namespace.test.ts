// @ts-nocheck -- Bun's test globals and mutable env fixtures are test-only.
import { afterEach, describe, expect, test } from "bun:test";
import { teamChatRedisChannel } from "../chat/realtime";
import {
  getRedisNamespace,
  parseTeamChatRedisChannel,
  teamChatRedisSubscriptionPattern,
} from "../redis-namespace";

const originalRedisNamespace = process.env.REDIS_NAMESPACE;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalRedisNamespace === undefined) {
    delete process.env.REDIS_NAMESPACE;
  } else {
    process.env.REDIS_NAMESPACE = originalRedisNamespace;
  }

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

describe("Redis namespace", () => {
  test("prefixes team chat channels with the configured namespace", () => {
    process.env.REDIS_NAMESPACE = "plantain:prod";

    expect(teamChatRedisChannel("trip_42")).toBe(
      "plantain:prod:trip:trip_42:chat",
    );
  });

  test("defaults to a Plantain namespace for the active environment", () => {
    expect(getRedisNamespace({ NODE_ENV: "staging" })).toBe("plantain:staging");
    expect(getRedisNamespace({})).toBe("plantain:development");
  });

  test("rejects namespaces that can alter Redis glob subscriptions", () => {
    for (const REDIS_NAMESPACE of [
      "plantain:*",
      "plantain:?",
      "plantain:[prod]",
      String.raw`plantain:\prod`,
    ]) {
      expect(() => getRedisNamespace({ REDIS_NAMESPACE })).toThrow(
        /REDIS_NAMESPACE/,
      );
    }
  });

  test("scopes team chat subscriptions to one namespace", () => {
    expect(teamChatRedisSubscriptionPattern("plantain:prod")).toBe(
      "plantain:prod:trip:*:chat",
    );
  });

  test("parses trip ids only from canonical channels in the active namespace", () => {
    expect(
      parseTeamChatRedisChannel(
        "plantain:prod:trip:trip_42:chat",
        "plantain:prod",
      ),
    ).toBe("trip_42");
    expect(
      parseTeamChatRedisChannel(
        "plantain:staging:trip:trip_42:chat",
        "plantain:prod",
      ),
    ).toBeNull();
    expect(
      parseTeamChatRedisChannel("plantain:prod:trip::chat", "plantain:prod"),
    ).toBeNull();
    expect(
      parseTeamChatRedisChannel(
        "plantain:prod:trip:trip_42:chat:extra",
        "plantain:prod",
      ),
    ).toBeNull();
  });
});
