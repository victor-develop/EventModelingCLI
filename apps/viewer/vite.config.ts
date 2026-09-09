import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
