import 'dotenv/config';
import { createApp } from './app';
import { prisma } from './lib/prisma';

const app = createApp();
const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => console.log(`API running on port ${PORT}`));

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
