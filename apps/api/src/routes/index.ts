import { Application } from 'express';
import { authRouter } from './auth.routes';

export function registerRoutes(app: Application) {
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRouter);
  // mounted as modules are built:
  // app.use('/accounts', accountsRouter);
  // app.use('/split-rules', splitsRouter);
  // app.use('/deferrals', deferralsRouter);
  // app.use('/forecasts', forecastsRouter);
  // app.use('/squad', squadWebhookRouter);
  // app.use('/demo', demoRouter);
}
