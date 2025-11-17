import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Use forks pool to avoid whatwg-url issues
    pool: 'forks',
    // Prevent hanging processes
    teardownTimeout: 5000,
    testTimeout: 10000,
    // Ensure clean exit
    isolate: true,
    // Run tests in sequence to avoid conflicts
    sequence: {
      shuffle: false,
    },
  },
})

