import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

(BigInt.prototype as any).toJSON = function () { return this.toString(); };

import { createApp } from './app';
import { registerRoutes } from './routes';
import { prisma } from './lib/prisma';
import './workers';

const app = createApp();
registerRoutes(app);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Nightly forecast regeneration — 2am Lagos time
import cron from 'node-cron';
import { prisma as cronPrisma } from './lib/prisma';
import { forecastsQueue as cronForecastsQueue } from './lib/queues';

cron.schedule('0 2 * * *', async () => {
  const farmers = await cronPrisma.farmer.findMany();
  for (const f of farmers) {
    await cronForecastsQueue.add('regenerate', { farmerId: f.id });
  }
}, { timezone: 'Africa/Lagos' });
