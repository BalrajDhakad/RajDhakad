// Hero projects come from src/content/work/*.md (frontmatter + markdown body).
const files = import.meta.glob('../content/work/*.md', { eager: true });

export const HEROES = Object.entries(files)
  .map(([p, m]) => ({ slug: p.split('/').pop().replace(/\.md$/, ''), ...m.frontmatter, Content: m.Content }))
  .sort((a, b) => a.order - b.order);

// YouTube thumbnails. maxres exists for most HD uploads; the <img> falls back to mq (always 16:9) if it 404s.
export const thumbMax = id => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
export const thumbMq = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
