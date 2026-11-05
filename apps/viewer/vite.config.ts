import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'event-modeling-spec-cli/viewer-contract/lanePolicy',
      'event-modeling-spec-cli/viewer-contract/redaction',
    ],
  },
  test: {
    environment: 'jsdom',
  },
  server: {
    fs: {
      allow: ['../..'],
    },
    proxy: {
      '/api': 'http://localhost:5198',
    },
  },
})
