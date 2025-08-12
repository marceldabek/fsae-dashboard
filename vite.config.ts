
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// dev ignores base; prod uses it
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/fsae-dashboard/' : '/',
  build: {
    outDir: 'docs',
    // Split big vendor libs into their own chunks
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('react-router')) return 'vendor-react-router';
            if (id.includes('react')) return 'vendor-react';
            return 'vendor';
          }
        },
      },
    },
    // After splitting, allow a slightly higher limit before warning
    chunkSizeWarningLimit: 1000,
  },
})
