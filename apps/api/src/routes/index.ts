import { Application } from 'express';
import { authRouter } from './auth.routes';
import { squadWebhookRouter } from './squad-webhook.routes';
import { accountsRouter } from './accounts.routes';
import { splitsRouter } from './splits.routes';

export function registerRoutes(app: Application) {
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRouter);
  app.use('/squad', squadWebhookRouter);
  // mounted as modules are built:
  app.use('/accounts', accountsRouter);
  app.use('/split-rules', splitsRouter);
  // app.use('/deferrals', deferralsRouter);
  // app.use('/forecasts', forecastsRouter);
  // app.use('/demo', demoRouter);
}
