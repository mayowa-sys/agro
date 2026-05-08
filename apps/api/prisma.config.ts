import path from 'path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  migrate: {
    async adapter() {
      const { PrismaPg } = await import('@prisma/adapter-pg');
      const { default: pg } = await import('pg');
      const connectionString = process.env.DATABASE_URL!;
      const pool = new pg.Pool({ connectionString });
      return new PrismaPg(pool);
    },
  },
});
