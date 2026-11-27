import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const escape = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);

const MAX_PROJECTS = 6;
const COLUMNS = 2;
const brands = {javascript: ['f7df1e', 'javascript', 'black'], python: ['3776ab', 'python'], typescript: ['3178c6', 'typescript'], go: ['00add8', 'go'], rust: ['24292f', 'rust']};

function badgeUrl(parts, color, logo, logoColor = 'white') {
  const label = parts.map(part => encodeURIComponent(part.replaceAll('-', '--').replaceAll('_', '__'))).join('-');
  const query = new URLSearchParams({style: 'flat-square'});
  if (logo) { query.set('logo', logo); query.set('logoColor', logoColor); }
  return `https://img.shields.io/badge/${label}-${color}?${query}`;
}

export function featured(readme, owner, repos, images = new Map()) {
  const isProfileRepo = repo => repo.name.toLowerCase() === owner.toLowerCase();
  const selected = repos.filter(repo => repo.owner?.login?.toLowerCase() === owner.toLowerCase()
    && repo.private === false && repo.fork === false)
    .sort((a, b) => Number(isProfileRepo(a)) - Number(isProfileRepo(b))
      || b.stargazers_count - a.stargazers_count || b.forks_count - a.forks_count || a.name.localeCompare(b.name, 'en'))
    .slice(0, MAX_PROJECTS);
  const cards = selected.map(repo => {
    const isProfile = isProfileRepo(repo);
    const description = (typeof repo.description === 'string' ? repo.description.replace(/\s+/gu, ' ').trim() : '')
      || (isProfile ? 'The source for this GitHub profile README.' : '');
    const url = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}`;
    const license = repo.license?.spdx_id;
    const language = typeof repo.language === 'string' ? repo.language : '';
    const brand = Object.hasOwn(brands, language.toLowerCase()) ? brands[language.toLowerCase()] : ['555555'];
    const badges = [
      repo.stargazers_count > 0 && [`${repo.stargazers_count} Stars`, ['Stars', String(repo.stargazers_count)], '555555', 'github'],
      repo.forks_count > 0 && [`${repo.forks_count} Forks`, ['Forks', String(repo.forks_count)], '555555', 'github'],
      language && [language, [language], ...brand],
      license && license !== 'NOASSERTION' && [license, ['License', license], '2e7d32'],
      ...(isProfile ? [['Activity Charts', ['Activity', 'Charts'], '0969da'], ['Contribution Snake', ['Contributions', 'Snake'], '2e7d32']] : []),
      ...(Array.isArray(repo.topics) ? repo.topics.filter(topic => typeof topic === 'string' && /^[\w-]{1,24}$/.test(topic)).map(topic => [topic, [topic], '555555']) : []),
    ].filter(Boolean).slice(0, 3).map(([label, parts, color, logo, logoColor]) => {
      const url = badgeUrl(parts, color, logo, logoColor);
      const name = `${createHash('sha256').update(url).digest('hex')}.svg`;
      images.set(name, url);
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
  const download = promisify(execFile);
  const assets = await Promise.all([...images].filter(([name]) => !existsSync(`${dir}/${name}`)).map(async ([name, url]) => {
    const {stdout: svg} = await download('curl', ['--ipv4', '--fail', '--silent', '--show-error', '--max-time', '12', '--retry', '2', '--retry-max-time', '30', url]);
    if (!/^<svg\b/.test(svg) || !svg.includes('</svg>')) throw new Error(`Invalid badge ${name}`);
    return [name, svg];
  }));
  mkdirSync(dir, {recursive: true});
  for (const [name, svg] of assets) writeFileSync(`${dir}/${name}`, svg);
  for (const name of readdirSync(dir)) {
    if (/^(?:[1-6]-[1-3]|[a-f0-9]{64})\.svg$/.test(name) && !images.has(name)) unlinkSync(`${dir}/${name}`);
  }
  if (source !== next) writeFileSync('README.md', next);
}
