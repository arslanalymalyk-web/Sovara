import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  // with a real database every file wipes and rebuilds the same schema, so files must not run at the same time
  test: { include: ['tests/**/*.test.ts'], testTimeout: 60_000, hookTimeout: 60_000, fileParallelism: !process.env.TEST_DATABASE_URL },
});
