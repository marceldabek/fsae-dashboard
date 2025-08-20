
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// dev ignores base; prod uses it
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/fsae-dashboard/' : '/',
  resolve: {
  dedupe: ['react', 'react-dom'],
  alias: { "@": path.resolve(__dirname, "./src") }
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
