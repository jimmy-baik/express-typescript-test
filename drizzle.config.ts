import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './src/adapters/secondary/db/migrations',
  schema: './src/adapters/secondary/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_URL!,
  },
});
