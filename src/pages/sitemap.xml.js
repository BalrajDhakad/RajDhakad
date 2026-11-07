import { SITE } from '../site.config.js';

export function GET() {
  const work = Object.keys(import.meta.glob('../content/work/*.md')).map(p => '/work/' + p.split('/').pop().replace(/\.md$/, ''));
  const urls = ['/', '/about', '/start', '/terms', ...work];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${SITE.url}${u === '/' ? '' : u}</loc></url>`).join('\n') + `\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
