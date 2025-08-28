import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Opcional: definir variáveis globais se necessário
    'process.env': {}
  },
  server: {
    port: 3000,
  }
})