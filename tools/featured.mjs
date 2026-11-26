import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const escape = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);

const MAX_PROJECTS = 6;
const COLUMNS = 2;
const logoArt = Object.fromEntries(['javascript', 'python'].map(name => {
  const svg = readFileSync(new URL(`../assets/featured-${name}.svg`, import.meta.url), 'utf8');
  return [name, svg.trim().replace(/^<svg[^>]*>|<\/svg>$/g, '')];
}));
const brands = {javascript: ['#f7df1e', '#242424', 'JS', 'javascript'], python: ['#3776ab', '#ffffff', 'Py', 'python'], typescript: ['#3178c6', '#ffffff', 'TS']};

function badgeSvg(label, color, ink, icon, logo) {
  const width = 28 + label.length * 7 + (logo ? 0 : Math.max(0, icon.length - 1) * 5);
  const mark = logo
    ? `<svg x="3" y="3" width="14" height="14" viewBox="0 0 16 16">${logoArt[logo]}</svg>`
    : `<text x="10" y="14" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="12" font-weight="bold">${escape(icon)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" viewBox="0 0 ${width} 20"><rect width="${width}" height="20" fill="${color}"/><rect width="20" height="20" fill="#24292f"/>${mark}<text x="25" y="14" textLength="${label.length * 6.5}" lengthAdjust="spacingAndGlyphs" fill="${ink}" font-family="Verdana, sans-serif" font-size="11">${escape(label)}</text></svg>\n`;
}

export function featured(readme, owner, repos, images = new Map()) {
  const selected = repos.filter(repo => repo.owner?.login?.toLowerCase() === owner.toLowerCase()
    && repo.private === false && repo.fork === false)
    .sort((a, b) => b.stargazers_count - a.stargazers_count || b.forks_count - a.forks_count || a.name.localeCompare(b.name, 'en'))
    .slice(0, MAX_PROJECTS);
  const cards = selected.map((repo, rank) => {
    const isProfile = repo.name.toLowerCase() === owner.toLowerCase();
    const description = (typeof repo.description === 'string' ? repo.description.replace(/\s+/gu, ' ').trim() : '')
      || (isProfile ? 'The source for this GitHub profile README.' : '');
    const url = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}`;
    const license = repo.license?.spdx_id;
    const language = typeof repo.language === 'string' ? repo.language : '';
    const brand = Object.hasOwn(brands, language.toLowerCase()) ? brands[language.toLowerCase()] : ['#424a53', '#ffffff', '<>'];
    const neutral = (label, icon) => [label, '#424a53', '#ffffff', icon];
    const badges = [
      repo.stargazers_count > 0 && neutral(`${repo.stargazers_count} Stars`, '\u2605'),
      repo.forks_count > 0 && neutral(`${repo.forks_count} Forks`, '\u2442'),
      language && [language, ...brand],
      license && license !== 'NOASSERTION' && neutral(license, '\u2696'),
      ...(isProfile ? [neutral('Activity Charts', '\u25a5'), neutral('Contribution Snake', '\u223f')] : []),
      ...(Array.isArray(repo.topics) ? repo.topics.filter(topic => typeof topic === 'string' && /^[\w-]{1,24}$/.test(topic)).map(topic => neutral(topic, '#')) : []),
    ].filter(Boolean).slice(0, 3).map(([label, color, ink, icon, logo], i) => {
      const name = `${rank + 1}-${i + 1}.svg`;
      images.set(name, badgeSvg(label, color, ink, icon, logo));
      return `<img alt="${escape(label)}" src="assets/featured/${name}">`;
    }).join(' ');
    return [
      `<td width="${selected.length === 1 ? '400' : '50%'}" align="left" valign="top">`,
      `<strong><a href="${url}">${escape(repo.name)}</a></strong>`,
      ...(description ? [`<br><sub>${escape(description)}</sub>`] : []),
      ...(isProfile ? ['<ul><li><sub>Public projects ranked by stars and forks.</sub></li><li><sub>Commit and language charts, plus a light and dark contribution snake.</sub></li></ul>'] : []),
      ...(badges ? [`${isProfile ? '' : '<br>'}${badges}`] : []),
      '</td>',
    ].join('\n');
  });
  const rows = [];
  for (let i = 0; i < cards.length; i += COLUMNS) {
    rows.push(`<tr>\n${cards.slice(i, i + COLUMNS).join('\n')}\n</tr>`);
  }
  const content = rows.length ? `\n### <ins><sup>FEATURED PROJECTS</sup></ins>\n\n<div align="left">\n<table>\n${rows.join('\n')}\n</table>\n</div>\n` : '';
  const start = '<!-- featured-projects:start -->';
  const end = '<!-- featured-projects:end -->';
  const from = readme.indexOf(start);
  const to = readme.indexOf(end);
  if (from < 0 || to < from || readme.lastIndexOf(start) !== from || readme.lastIndexOf(end) !== to) throw new Error('Expected one featured block');
  return readme.slice(0, from + start.length) + (content ? `\n${content}\n` : '\n') + readme.slice(to);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [owner, inventory] = process.argv.slice(2);
  if (!/^[a-z\d][a-z\d-]*$/i.test(owner ?? '') || !inventory) throw new Error('Expected owner and repository JSON path');
  const images = new Map();
  const source = readFileSync('README.md', 'utf8');
  const next = featured(source, owner, JSON.parse(readFileSync(inventory, 'utf8')), images);
  const dir = 'assets/featured';
  mkdirSync(dir, {recursive: true});
  for (const [name, svg] of images) writeFileSync(`${dir}/${name}`, svg);
  for (const name of readdirSync(dir)) {
    if (/^[1-6]-[1-3]\.svg$/.test(name) && !images.has(name)) unlinkSync(`${dir}/${name}`);
  }
  if (source !== next) writeFileSync('README.md', next);
}
