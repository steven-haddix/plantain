import { Redis } from '@upstash/redis';

export const redisClient = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

class RedisService {
    constructor(private readonly client: Redis) { }

    async get(key: string): Promise<string | null> {
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

    async setJson(key: string, value: any, expiration?: number): Promise<void> {
        const jsonValue = JSON.stringify(value);
        await this.set(key, jsonValue, expiration);
    }

    async getJson<T>(key: string): Promise<T | null> {
        const value = await this.get(key);
        console.log('value:', value);
        if (value) {
            return JSON.parse(value) as T;
        }
        return null;
    }

    async cacheWrapper<T>(
        key: string,
        fetchData: () => Promise<T>,
        expiration?: number,
    ): Promise<T> {
        const cachedData = (await this.get(key)) as T | null;
        if (cachedData) {
            return cachedData;
        }

        const freshData = await fetchData();
        await this.setJson(key, freshData, expiration);
        return freshData;
    }
}

export const redisCacheService = new RedisService(redisClient);
