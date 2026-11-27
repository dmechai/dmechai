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

function selectProjects(owner, repos) {
  return repos.filter(repo => repo.owner?.login?.toLowerCase() === owner.toLowerCase()
    && repo.private === false && repo.fork === false)
    .sort((a, b) => Number(a.name.toLowerCase() === owner.toLowerCase()) - Number(b.name.toLowerCase() === owner.toLowerCase())
      || b.stargazers_count - a.stargazers_count || b.forks_count - a.forks_count || a.name.localeCompare(b.name, 'en'))
    .slice(0, MAX_PROJECTS);
}

export function readHighlights(markdown) {
  const block = markdown.match(/^<!-- featured-highlights:start -->\s*\r?\n([\s\S]*?)^<!-- featured-highlights:end -->\s*$/m)?.[1] ?? '';
  return block.split(/\r?\n/).map(line => line.match(/^[-*] (\S.{0,119})$/)?.[1].trim()).filter(Boolean).slice(0, 2);
}

export function featured(readme, owner, repos, images = new Map()) {
  const selected = selectProjects(owner, repos);
  const cards = selected.map(repo => {
    const isProfile = repo.name.toLowerCase() === owner.toLowerCase();
    const highlights = repo.highlights?.length ? repo.highlights : isProfile ? [
      'Public projects ranked by stars and forks.',
      'Commit and language charts, plus a light and dark contribution snake.',
    ] : owner.toLowerCase() === 'dmechai' && repo.name.toLowerCase() === 'oriel-nft' ? [
      'Explore art directions from a reference image and lock in a consistent style.',
      'Export generated images, NFT metadata, and rarity statistics.',
    ] : [];
    const description = (typeof repo.description === 'string' ? repo.description.replace(/\s+/gu, ' ').trim() : '')
      || (isProfile ? 'GitHub profile README with project highlights, activity charts, and a contribution snake.' : '');
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
      `<strong><a href="${url}">${escape(repo.name)}</a></strong>${description ? `<br><sub>${escape(description)}</sub>` : ''}`,
      ...highlights.map(text => `<br><sub>•&nbsp; ${escape(text)}</sub>`),
      ...(badges ? [`<br>${badges}`] : []),
    ].join('\n');
  });
  const rows = [];
  const cell = content => `<td width="${cards.length === 1 ? '400' : '50%'}" align="left" valign="top">${content}</td>`;
  for (let i = 0; i < cards.length; i += COLUMNS) {
    const pair = cards.slice(i, i + COLUMNS);
    // GitHub shades even rows within each table body.
    rows.push(`<tbody>\n<tr>\n${pair.map(cell).join('\n')}\n</tr>\n</tbody>`);
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
  const repos = JSON.parse(readFileSync(inventory, 'utf8'));
  const download = promisify(execFile);
  await Promise.all(selectProjects(owner, repos).map(async repo => {
    let markdown = source;
    if (repo.name.toLowerCase() !== owner.toLowerCase()) {
      try {
        const endpoint = `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}/readme`;
        const {stdout} = await download('gh', ['api', '-H', 'Accept: application/vnd.github.raw+json', endpoint], {timeout: 20000});
        markdown = stdout;
      } catch (error) {
        if (!/\(HTTP 404\)/.test(error.stderr ?? '')) throw error;
        markdown = '';
      }
    }
    repo.highlights = readHighlights(markdown);
  }));
  const next = featured(source, owner, repos, images);
  const dir = 'assets/featured';
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
