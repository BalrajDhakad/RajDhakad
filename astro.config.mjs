import { defineConfig } from 'astro/config';
import { SITE } from './src/site.config.js';

// Static output. Vercel runs `npm run build` and serves /dist. No adapter needed.
export default defineConfig({
  site: SITE.url,
  trailingSlash: 'never',
  build: { format: 'file' },   // about.html -> /about (vercel.json turns on cleanUrls)
  compressHTML: true
});
