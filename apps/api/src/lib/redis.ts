import Redis from 'ioredis';

// General-purpose client (cache, idempotency keys, etc.)
export const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
});

// BullMQ requires maxRetriesPerRequest: null — use this for all Queue/Worker connections
export const bullRedis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});
