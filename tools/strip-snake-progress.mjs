import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function stripProgress(svg) {
  if (!/^<svg\b/.test(svg) || !/<\/svg>\s*$/.test(svg) || !/<rect class="s s\w+"/.test(svg)) {
    throw new Error('Unexpected Platane/snk SVG format');
  }
  return svg.replace(/<rect class="u u[\da-z]+"[^>]*\/>/g, '');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const path of process.argv.slice(2)) {
    const svg = readFileSync(path, 'utf8');
    const stripped = stripProgress(svg);
    if (svg !== stripped) writeFileSync(path, stripped);
  }
}
