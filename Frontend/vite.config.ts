import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * La vista previa al compartir (WhatsApp, Facebook) necesita direcciones completas:
 * index.html usa %SITE_URL% y aquí se reemplaza por VITE_SITE_URL (sin «/» final).
 * Sin esa variable se usa la dirección que dan Vercel o Cloudflare Pages al construir;
 * fuera de ellos quedan rutas relativas, que sirven en el navegador.
 */
function siteUrl(url: string): Plugin {
  return {
    name: 'aspar-site-url',
    transformIndexHtml: (html) =>
      html.replaceAll('%SITE_URL%', url.replace(/\/+$/, '')),
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const publicUrl =
    env.VITE_SITE_URL ||
    (vercel ? `https://${vercel}` : process.env.CF_PAGES_URL) ||
    ''
  return {
    plugins: [vue(), siteUrl(publicUrl)],
    server: {
      // En Docker Desktop (Windows) los cambios de archivos no llegan al contenedor:
      // docker-compose.yml activa el sondeo con WATCH_POLLING=true.
      watch: { usePolling: process.env.WATCH_POLLING === 'true' },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.spec.ts'],
    },
  }
})
