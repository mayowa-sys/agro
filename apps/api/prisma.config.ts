import path from 'path';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://agro:agro@localhost:5432/agro';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  datasource: {
    url: connectionString,
  },
  migrate: {
    async adapter() {
      const pool = new pg.Pool({ connectionString });
      return new PrismaPg(pool);
    },
    seed: 'ts-node prisma/seed.ts',
  },
});
