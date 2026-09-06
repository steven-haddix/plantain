const REDIS_NAMESPACE_PATTERN = /^[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)*$/;

export function getRedisNamespace(
  env: { REDIS_NAMESPACE?: string; NODE_ENV?: string } = process.env,
) {
  const namespace =
    env.REDIS_NAMESPACE ?? `plantain:${env.NODE_ENV || "development"}`;

  if (!REDIS_NAMESPACE_PATTERN.test(namespace)) {
    throw new Error(
      "REDIS_NAMESPACE must contain only letters, numbers, colons, hyphens, and underscores.",
    );
  }

  return namespace;
}

export function teamChatRedisChannel(
  tripId: string,
  namespace = getRedisNamespace(),
) {
  return `${namespace}:trip:${tripId}:chat`;
}

export function teamChatRedisSubscriptionPattern(
  namespace = getRedisNamespace(),
) {
  return `${namespace}:trip:*:chat`;
}

export function parseTeamChatRedisChannel(
  channel: string,
  namespace = getRedisNamespace(),
) {
  const prefix = `${namespace}:trip:`;
  const suffix = ":chat";

  if (!channel.startsWith(prefix) || !channel.endsWith(suffix)) {
    return null;
  }

  const tripId = channel.slice(prefix.length, -suffix.length);
  if (!tripId || teamChatRedisChannel(tripId, namespace) !== channel) {
    return null;
  }

  return tripId;
}

export function namespacedRedisKey(
  key: string,
  namespace = getRedisNamespace(),
) {
  return `${namespace}:${key}`;
}
