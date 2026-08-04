import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/**
 * Standalone preview for front components.
 *
 * The real component runs inside Twenty's front-component sandbox. Here it runs
 * as a plain React app, with the three Twenty imports aliased to local stubs so
 * no Twenty server is required.
 */
export default defineConfig({
  root: here,
  server: { port: 4001, open: true },
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  resolve: {
    alias: [
      { find: 'twenty-sdk/define', replacement: resolve(here, 'stubs/define.ts') },
      {
        find: 'twenty-sdk/front-component',
        replacement: resolve(here, 'stubs/front-component.tsx'),
      },
      {
        find: 'twenty-client-sdk/rest',
        replacement: resolve(here, 'stubs/rest.ts'),
      },
      { find: /^src\//, replacement: `${resolve(root, 'src')}/` },
    ],
  },
});
