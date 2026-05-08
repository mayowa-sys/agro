import { Queue } from 'bullmq';
import { redis } from './redis';

const connection = { connection: redis };
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1000 },
};

export const splitsQueue    = new Queue('splits',    { ...connection, defaultJobOptions });
export const factoringQueue = new Queue('factoring', { ...connection, defaultJobOptions });
export const deferralsQueue = new Queue('deferrals', { ...connection, defaultJobOptions });
export const briefsQueue    = new Queue('briefs',    { ...connection, defaultJobOptions });
export const forecastsQueue = new Queue('forecasts', { ...connection, defaultJobOptions });
