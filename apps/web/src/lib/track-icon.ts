/**
 * Short label shown inside a track's hexagon (components/ui/HexIcon.tsx).
 * Known topics get a fixed label; anything else uses the first letters of the title.
 * To give a new track a nicer label, add its slug or a tag here.
 */
const LABEL_BY_TAG: Record<string, string> = {
  sql: 'SQL',
  postgresql: 'SQL',
  git: 'Git',
  github: 'Git',
  docker: 'Dkr',
  python: 'Py',
  javascript: 'JS',
  typescript: 'TS',
  html: 'HTML',
  css: 'CSS',
  java: 'Java',
  discord: 'DA', // Discord Automation
};

export function trackIconLabel(track: { title: string; tags?: string[] }): string {
  // Tags first; then known topics in the title, so pages without tags (the dashboard
  // only gets titles) still show the same label, e.g. "30 ngày học SQL" → "SQL".
  const words = track.title.split(/[\s,.:()&/-]+/).filter(Boolean);
  for (const key of [...(track.tags ?? []), ...words]) {
    const label = LABEL_BY_TAG[key.toLowerCase()];
    if (label) return label;
  }
  const letters = words.filter((w) => /^\p{L}/u.test(w));
  return (letters[0]?.[0] ?? '?').toUpperCase() + (letters[1]?.[0] ?? '').toUpperCase();
}
