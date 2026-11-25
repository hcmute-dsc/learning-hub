import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for the pure rules next to the components (*.test.ts). No DOM needed.
// A test may render a component to a string (react-dom/server); tsconfig keeps JSX for
// Next ("preserve"), so the tests compile it with React's automatic runtime.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
