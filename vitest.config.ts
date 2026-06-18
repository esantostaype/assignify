import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Tests del motor (núcleo puro). Alias '@' → ./src para que las pruebas importen
// igual que el código de la app.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
