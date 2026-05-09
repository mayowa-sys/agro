import path from 'path';
import dotenv from 'dotenv';
import './workers';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { createApp } from './app';
import { prisma } from './lib/prisma';

const app = createApp();
const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => console.log(`API running on port ${PORT}`));

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
