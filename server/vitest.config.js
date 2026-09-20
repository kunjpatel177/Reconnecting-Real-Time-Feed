import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure mongodb-memory-server always uses the cached binary inside server/node_modules
process.env.MONGOMS_DOWNLOAD_DIR = path.resolve(__dirname, 'node_modules/.cache/mongodb-memory-server');

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 60000
  }
});
