
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// dev ignores base; prod uses it
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/fsae-dashboard/' : '/',
})
