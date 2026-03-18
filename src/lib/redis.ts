import { createClient } from "redis";

const createRedisConnection = () => createClient({ url: getRedisUrl() });
type AppRedisClient = ReturnType<typeof createRedisConnection>;

let redisClientPromise: Promise<AppRedisClient> | null = null;

const getRedisUrl = () => {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not defined in environment variables");
  }

  return process.env.REDIS_URL;
};

async function getRedisClient() {
  if (!redisClientPromise) {
    const client = createRedisConnection();
    client.on("error", (error) => {
      console.error("Redis client error:", error);
    });
    redisClientPromise = client.connect().then(() => client as AppRedisClient);
  }

  return redisClientPromise;
}

class RedisService {
  async get(key: string): Promise<string | null> {
    const client = await getRedisClient();
    return client.get(key);
  }

  async set(key: string, value: string, expiration?: number): Promise<void> {
    const client = await getRedisClient();

    if (expiration) {
      await client.set(key, value, { EX: expiration });
    } else {
      await client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    const client = await getRedisClient();
    await client.del(key);
  }

  async setJson(
    key: string,
    value: unknown,
    expiration?: number,
  ): Promise<void> {
    await this.set(key, JSON.stringify(value), expiration);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);

    if (value === null || value === undefined) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async cacheWrapper<T>(
    key: string,
    fetchData: () => Promise<T>,
    expiration?: number,
  ): Promise<T> {
    const cachedData = await this.getJson<T>(key);
    if (cachedData !== null) {
      return cachedData;
    }

    const freshData = await fetchData();
    await this.setJson(key, freshData, expiration);
    return freshData;
  }
}

export { getRedisClient };
export const redisCacheService = new RedisService();
