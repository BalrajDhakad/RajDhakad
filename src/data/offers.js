// Single source for the offer cards. The page shows USD by default; the INR switch swaps the numbers.
// NOTE: these are the prices the LIVE site shows today (the old script overwrote the visible numbers with these values).
export const OFFERS = [
  {
    name: 'SaaS Launch Video', pick: 'SaaS Launch Video', len: 'Under 60 seconds',
    usd: '749', inr: '69,000', meta: '2–3 weeks · 2 revision rounds',
    list: ['Script, storyboard and style frames', 'UI and product motion from your screens', 'Licensed music and sound design', '16:9 master plus one 9:16 cut'],
    no: 'Professional voiceover · Extra cutdowns · Source project files'
  },
  {
    name: 'Brand Film', pick: 'Brand Film', len: '60–100 seconds',
    usd: '1,049', inr: '99,000', meta: '3–4 weeks · 2 revision rounds',
    list: ['Concept and script', 'Storyboard and style frames', 'Motion design, sound and licensed music', 'Colour finishing', '16:9 master plus a 9:16 cutdown'],
    no: 'Live-action shoots (quoted separately) · Professional voiceover · Source project files'
  },
  {
    name: 'Personalized Motion Identity Design', pick: 'Motion Identity', len: 'For an existing brand',
    usd: '1,349', inr: '1,29,000', meta: '5–6 weeks · 2 revision rounds per phase',
    list: ['Brand Kit: audit, logo suite, colour and type specs', '15–20 page guidelines PDF and core templates', 'Motion Kit: motion principles and logo animation', 'Transitions, title, lower-third and end-card system', 'Social motion templates (MP4, alpha, Lottie)'],
    no: 'Logo redesign · Naming and messaging strategy · Print and websites · Source project files'
  }
];

export const SPECIALIZATIONS = [
  { t: 'SaaS Launch Videos', p: 'Product reveals and launch films that make a release land.' },
  { t: 'Brand Film', p: 'Story-led films that give a brand a point of view.' },
  { t: 'Personalized Motion Identity Design', p: 'Logo, type and motion systems that move as one.' }
];

export const PROCESS = [
  ['01', 'Understand', 'What must the viewer feel, and in how many seconds.'],
  ['02', 'Explore', 'Fast boards and rough timing. Kill weak ideas early.'],
  ['03', 'Design', 'Frames, type and colour locked before anything moves.'],
  ['04', 'Animate', 'Easing, weight and rhythm, one beat at a time.'],
  ['05', 'Refine', 'Trim, retime, export. Ship it clean.']
];
