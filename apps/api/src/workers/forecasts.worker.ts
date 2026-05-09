import { Worker } from 'bullmq';
import { bullRedis } from '../lib/redis';
import { runForecast } from '../services/forecast.service';

new Worker('forecasts', async (job) => {
  if (job.name === 'regenerate') {
    const { farmerId } = job.data;
    await runForecast(farmerId);
    console.log(`Forecast regenerated for farmer ${farmerId}`);
  }
}, { connection: bullRedis });
