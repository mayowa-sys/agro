import { Application } from 'express';
import { authRouter } from './auth.routes';
import { squadWebhookRouter } from './squad-webhook.routes';
import { accountsRouter } from './accounts.routes';
import { splitsRouter } from './splits.routes';
import { deferralsRouter } from './deferrals.routes';
import { factoringRouter } from './factoring.routes';
import { forecastsRouter } from './forecasts.routes';
import { demoRouter } from './demo.routes';
import { labourersRouter } from './labourers.routes';
import { jobsRouter } from './jobs.routes';

export function registerRoutes(app: Application) {
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRouter);
  app.use('/squad', squadWebhookRouter);
  app.use('/accounts', accountsRouter);
  app.use('/split-rules', splitsRouter);
  app.use('/deferrals', deferralsRouter);
  app.use('/aggregator', factoringRouter);
  app.use('/liberation', factoringRouter);
  app.use('/forecasts', forecastsRouter);
  app.use('/demo', demoRouter);
  app.use('/labourers', labourersRouter);
  app.use('/jobs', jobsRouter);
}
