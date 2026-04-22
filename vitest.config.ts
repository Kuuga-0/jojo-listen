/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx', 'src/lib/**/*.test.ts', 'src/hooks/**/*.test.ts', 'src/components/**/*.test.tsx', 'src/theme/**/*.test.tsx'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'src/__tests__/**',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/**'
      ]
    }
  }
})