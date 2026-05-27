import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Імітує браузерне середовище (window, document, localStorage тощо)
    environment: 'jsdom',

    // Підключає @testing-library/jest-dom матчери глобально
    setupFiles: ['./src/__tests__/setup.ts'],

    // Глобальні функції (describe, it, expect) — без імпортів у файлах тестів
    globals: true,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/**/*.test.*', 'src/__tests__/**'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
