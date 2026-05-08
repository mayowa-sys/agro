import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { registerRoutes } from './routes';
import { errorHandler } from './lib/errors';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(pinoHttp());
  app.use('/squad/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());
  registerRoutes(app);
  app.use(errorHandler);
  return app;
}
