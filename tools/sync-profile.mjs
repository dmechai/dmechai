import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const escape = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[ch]);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : '';
const heading = title => `<h3 align="center"><ins><sup>${title}</sup></ins></h3>`;
const bar = pct => {
  const filled = Math.round(pct / 5);
  return '█'.repeat(filled) + '░'.repeat(20 - filled);
};

function techBlock({favorites, other}) {
  const badges = values => values.map(label => {
    if (typeof label !== 'string' || !label.trim() || label.length > 60 || /[\r\n]/.test(label)) {
      throw new Error('Invalid tech stack label');
    }
    const slug = encodeURIComponent(label.replace(/[-_]/g, ch => ch + ch));
    return `<img alt="${escape(label)}" src="https://img.shields.io/badge/${slug}-444444?style=flat-square">`;
  }).join(' ');
  const fav = badges(favorites);
  const groups = Object.entries(other).filter(([, values]) => values.length)
    .map(([group, values]) => `<p><sup>${escape(group)}</sup><br>\n${badges(values)}</p>`);
  if (!fav && !groups.length) return '';
  const more = groups.length ? `\n\n<details>\n<summary><sup>OTHER TECHNOLOGIES USED</sup></summary>\n\n${groups.join('\n\n')}\n\n</details>` : '';
  return `---\n\n${heading('MY TECH STACK')}${fav ? `\n\n<p><sup>PERSONAL FAVS:</sup><br>\n${fav}</p>` : ''}${more}`;
}

function factsBlock(events, publicRepoIds, profileRepo, now, featured) {
  const periods = ['Morning', 'Daytime', 'Evening', 'Night'];
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hours = [0, 0, 0, 0];
  const days = weekdays.map(() => 0);
  const seen = new Set();
  let latest = 0;
  const cutoff = now - 30 * 86400_000;
  for (const event of events) {
    const stamp = Date.parse(event.created_at);
    if (event.type !== 'PushEvent' || event.public !== true || event.repo?.name?.toLowerCase() === profileRepo
      || !publicRepoIds.has(event.repo?.id) || !Number.isFinite(stamp) || stamp < cutoff || stamp > now
      || typeof event.id !== 'string' || seen.has(event.id)) continue;
    seen.add(event.id);
    latest = Math.max(latest, stamp);
    const when = new Date(stamp);
    const hour = when.getUTCHours();
    hours[hour < 6 ? 3 : Math.floor(hour / 6) - 1]++;
    days[when.getUTCDay()]++;
  }
  const chart = (labels, counts, total) => ['```text', ...labels.map((label, i) => {
    const pct = 100 * counts[i] / total;
    return `${label.padEnd(10)} ${String(counts[i]).padStart(3)}  ${bar(pct)} ${pct.toFixed(1).padStart(5)}%`;
  }), '```'].join('\n');
  const primary = new Map();
  for (const {language} of featured) {
    const label = typeof language === 'string' ? language.replace(/[^\p{L}\p{N} .+#_()/-]/gu, '').slice(0, 20) : '';
    if (label) primary.set(label, (primary.get(label) ?? 0) + 1);
  }
  const ranked = [...primary].sort(([a, x], [b, y]) => y - x || a.localeCompare(b, 'en'));
  if (!seen.size && !ranked.length) return '';
  const blocks = ['---', heading('FUN FACTS')];
  if (seen.size) blocks.push(
    `Recent public pushes · Last 30 days · UTC · ${seen.size} recorded`,
    '**By time of day**', chart(periods, hours, seen.size),
    '**By day of week**', chart(weekdays, days, seen.size),
    `<sub>Latest recorded push: ${new Date(latest).toISOString().slice(0, 10)} UTC</sub>`,
  );
  if (ranked.length) blocks.push('**Primary language by featured repository**',
    chart(ranked.map(([label]) => label.padEnd(20)), ranked.map(([, n]) => n),
      ranked.reduce((sum, [, n]) => sum + n, 0)));
  return blocks.join('\n\n');
}

function replaceBlock(readme, name, content) {
  const begin = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const start = readme.indexOf(begin);
  const stop = readme.indexOf(end);
  if (start < 0 || stop < start || readme.lastIndexOf(begin) !== start || readme.lastIndexOf(end) !== stop) {
    throw new Error(`Expected one pair of ${name} markers`);
  }
  return readme.slice(0, start + begin.length) + (content ? `\n\n${content}\n\n` : '\n') + readme.slice(stop);
}

export function sync(readme, pages, owner, {account, languages = () => ({}), stack, events, now = Date.now()} = {}) {
  if (!/^[a-z\d][a-z\d-]*$/i.test(owner) || !Array.isArray(pages) || !pages.length || !pages.every(Array.isArray)) {
    throw new Error('Invalid GitHub repository response');
  }
  const publicRepos = pages.flat().filter(repo => repo.private === false && repo.visibility === 'public'
    && repo.owner?.login?.toLowerCase() === owner.toLowerCase() && typeof repo.name === 'string'
    && /^[a-z\d_.-]+$/i.test(repo.name) && ![owner.toLowerCase(), '.', '..'].includes(repo.name.toLowerCase()));
  const repos = publicRepos.filter(repo => Array.isArray(repo.topics) && repo.topics.includes('profile-featured'));
  repos.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const cards = repos.map(repo => {
    const url = `https://github.com/${owner}/${repo.name}`;
    const description = typeof repo.description === 'string' ? repo.description.replace(/\s+/gu, ' ').trim() : '';
    const updated = date(repo.pushed_at);
    return `<tr><td><strong><a href="${url}">${escape(repo.name)}</a></strong>${description ? `<br>${escape(description)}` : ''}<br><sub>${count(repo.stargazers_count)} stars &middot; ${count(repo.forks_count)} forks${updated ? ` &middot; Last pushed: ${updated} UTC` : ''}</sub></td></tr>`;
  });
  const bytes = new Map();
  for (const repo of repos) {
    for (const [language, size] of Object.entries(languages(repo.name))) {
      if (count(size)) bytes.set(language, (bytes.get(language) ?? 0) + size);
    }
  }
  const total = [...bytes.values()].reduce((sum, size) => sum + size, 0);
  const rows = [...bytes.entries()].sort(([a, x], [b, y]) => y - x || a.localeCompare(b, 'en')).slice(0, 8)
    .map(([language, size]) => {
      const percentage = 100 * size / total;
      const label = language.replace(/[^\p{L}\p{N} .+#_()/\-]/gu, '').slice(0, 20);
      return `${label.padEnd(20)} ${bar(percentage)} ${percentage.toFixed(1).padStart(5)}%`;
    });
  const languageBlock = rows.length ? `\n\n${heading('LANGUAGES')}\n\n\`\`\`text\n${rows.join('\n')}\n\`\`\`` : '';
  const block = cards.length ? `---\n\n<h2 align="center"><ins><sup>Featured Projects</sup></ins></h2>\n\n<table>\n${cards.join('\n')}\n</table>${languageBlock}` : '';
  let result = replaceBlock(readme, 'featured-projects', block);
  if (stack) result = replaceBlock(result, 'tech-stack', techBlock(stack));
  if (events) {
    const ids = new Set(publicRepos.map(repo => repo.id).filter(Number.isSafeInteger));
    result = replaceBlock(result, 'fun-facts', factsBlock(events, ids, `${owner}/${owner}`.toLowerCase(), now, repos));
  }
  if (!account) return result;
  if (!Number.isSafeInteger(account.public_repos) || !Number.isSafeInteger(account.followers)) {
    throw new Error('Invalid public account metrics');
  }
  const repositories = account.public_repos === 1 ? 'REPOSITORY' : 'REPOSITORIES';
  const followers = account.followers === 1 ? 'FOLLOWER' : 'FOLLOWERS';
  return replaceBlock(result, 'profile-metrics', `<p align="center"><samp>${account.public_repos} PUBLIC ${repositories} &nbsp;&middot;&nbsp; ${account.followers} ${followers}</samp></p>`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [owner, path = 'README.md'] = process.argv.slice(2);
  const original = readFileSync(path, 'utf8');
  const pages = JSON.parse(readFileSync(0, 'utf8'));
  if (!/^[a-z\d][a-z\d-]*$/i.test(owner ?? '')) throw new Error('Invalid GitHub owner');
  const api = endpoint => JSON.parse(execFileSync('gh', ['api', endpoint], {encoding: 'utf8', timeout: 30_000}));
  const eventOutput = execFileSync('gh', ['api', '--paginate', '--jq', '.[]', `users/${owner}/events/public?per_page=100`],
    {encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024});
  const next = sync(original, pages, owner, {
    account: api(`users/${owner}`),
    languages: name => api(`repos/${owner}/${name}/languages`),
    stack: JSON.parse(readFileSync(new URL('./tech-stack.json', import.meta.url), 'utf8')),
    events: eventOutput.split('\n').filter(line => line.trim()).map(line => JSON.parse(line)),
  });
  if (original !== next) writeFileSync(path, next);
}
