import { Redis } from "@upstash/redis";

export const redisClient = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

class RedisService {
  constructor(private readonly client: Redis) {}

  async get(key: string): Promise<unknown | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, expiration?: number): Promise<void> {
    if (expiration) {
      await this.client.set(key, value, { ex: expiration });
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async setJson(
    key: string,
    value: unknown,
    expiration?: number,
  ): Promise<void> {
    const jsonValue = JSON.stringify(value);
    await this.set(key, jsonValue, expiration);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);

    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "string") {
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    }

    return value as T;
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

export const redisCacheService = new RedisService(redisClient);
