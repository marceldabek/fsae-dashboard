
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// dev ignores base; prod uses it
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/fsae-dashboard/' : '/',
  resolve: {
    // Prevent multiple React copies (e.g. due to symlinked local packages like functions/ depending on root)
    dedupe: ['react', 'react-dom'],
  },
  server: {
    // Lock the dev port + make sure the client knows which port to use for HMR WS
    port: 5173,
    host: true,
  hmr: { clientPort: 5173, protocol: 'ws', host: 'localhost', port: 5173 },
    watch: {
      // Ignore firebase functions workspace (not part of frontend bundle) to avoid infinite rebuild loops
      ignored: ['**/functions/**']
    }
  },
  build: {
    outDir: 'docs',
    // Use Vite's default chunking to avoid circular-import execution pitfalls
    chunkSizeWarningLimit: 1000,
  },
})
