import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const begin = '<!-- featured-projects:start -->';
const end = '<!-- featured-projects:end -->';
const escape = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[ch]);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : '';

export function sync(readme, pages, owner) {
  if (!/^[a-z\d][a-z\d-]*$/i.test(owner) || !Array.isArray(pages) || !pages.length || !pages.every(Array.isArray)) {
    throw new Error('Invalid GitHub repository response');
  }
  const start = readme.indexOf(begin);
  const stop = readme.indexOf(end);
  if (start < 0 || stop < start || readme.lastIndexOf(begin) !== start || readme.lastIndexOf(end) !== stop) {
    throw new Error('Expected one pair of featured project markers');
  }
  const repos = pages.flat().filter(repo => repo.private === false && repo.visibility === 'public'
    && repo.owner?.login?.toLowerCase() === owner.toLowerCase() && typeof repo.name === 'string'
    && /^[a-z\d_.-]+$/i.test(repo.name) && ![owner.toLowerCase(), '.', '..'].includes(repo.name.toLowerCase())
    && Array.isArray(repo.topics) && repo.topics.includes('profile-featured'));
  repos.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const cards = repos.map(repo => {
    const url = `https://github.com/${owner}/${repo.name}`;
    const description = typeof repo.description === 'string' ? repo.description.replace(/\s+/gu, ' ').trim() : '';
    const updated = date(repo.pushed_at);
    return `<tr><td><strong><a href="${url}">${escape(repo.name)}</a></strong>${description ? `<br>${escape(description)}` : ''}${updated ? `<br><sub>Last pushed: ${updated}</sub>` : ''}</td></tr>`;
  });
  const block = cards.length ? `\n\n## Featured Projects\n\n<table>\n${cards.join('\n')}\n</table>\n\n` : '\n';
  return readme.slice(0, start + begin.length) + block + readme.slice(stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [owner, path = 'README.md'] = process.argv.slice(2);
  const original = readFileSync(path, 'utf8');
  const next = sync(original, JSON.parse(readFileSync(0, 'utf8')), owner ?? '');
  if (original !== next) writeFileSync(path, next);
}
