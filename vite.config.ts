import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // ビルド成果物を任意の場所に置いても動くよう相対パスにする
  base: './',
  server: {
    port: 5173,
    // データはURL（ポート番号）ごとに保存されるため、別ポートで起動しないようにする
    strictPort: true,
    open: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
