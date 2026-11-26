import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

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

export function sync(readme, pages, owner, {account, languages = () => ({})} = {}) {
  if (!/^[a-z\d][a-z\d-]*$/i.test(owner) || !Array.isArray(pages) || !pages.length || !pages.every(Array.isArray)) {
    throw new Error('Invalid GitHub repository response');
  }
  const repos = pages.flat().filter(repo => repo.private === false && repo.visibility === 'public'
    && repo.owner?.login?.toLowerCase() === owner.toLowerCase() && typeof repo.name === 'string'
    && /^[a-z\d_.-]+$/i.test(repo.name) && ![owner.toLowerCase(), '.', '..'].includes(repo.name.toLowerCase())
    && Array.isArray(repo.topics) && repo.topics.includes('profile-featured'));
  repos.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const escape = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[ch]);
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : '';
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
      const filled = Math.round(percentage / 5);
      const label = language.replace(/[^\p{L}\p{N} .+#_()/\-]/gu, '').slice(0, 20);
      return `${label.padEnd(20)} ${'█'.repeat(filled)}${'░'.repeat(20 - filled)} ${percentage.toFixed(1).padStart(5)}%`;
    });
  const languageBlock = rows.length ? `\n\n<h3 align="center"><ins><sup>LANGUAGES</sup></ins></h3>\n\n\`\`\`text\n${rows.join('\n')}\n\`\`\`` : '';
  const block = cards.length ? `---\n\n<h2 align="center"><ins><sup>Featured Projects</sup></ins></h2>\n\n<table>\n${cards.join('\n')}\n</table>${languageBlock}` : '';
  const result = replaceBlock(readme, 'featured-projects', block);
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
  const next = sync(original, pages, owner, {
    account: api(`users/${owner}`),
    languages: name => api(`repos/${owner}/${name}/languages`),
  });
  if (original !== next) writeFileSync(path, next);
}
