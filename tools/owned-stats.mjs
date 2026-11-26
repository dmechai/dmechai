import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const day = 86_400_000;
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const query = `query($from: DateTime!, $to: DateTime!) {
  viewer {
    login
    contributionsCollection(from: $from, to: $to) {
      commitContributionsByRepository(maxRepositories: 100) {
        repository { databaseId }
        contributions(first: 100) {
          nodes { occurredAt commitCount }
          pageInfo { hasNextPage }
        }
      }
    }
  }
}`;

function chart(rows, unit) {
  const total = rows.reduce((sum, [, n]) => sum + n, 0);
  if (!total) return '';
  const width = Math.max(...rows.map(([label]) => label.length));
  return ['```text', ...rows.map(([label, n]) => {
    const share = 100 * n / total;
    const blocks = Math.round(share / 5);
    const quantity = `${n} ${unit}${n === 1 ? '' : 's'}`.padStart(unit.length + 5);
    return `${label.padEnd(width)}  ${quantity}  ${'█'.repeat(blocks)}${'░'.repeat(20 - blocks)}  ${share.toFixed(1).padStart(5)}%`;
  }), '```'].join('\n');
}

export function aggregate(readme, owner, repos, viewer, from, to) {
  if (viewer?.login?.toLowerCase() !== owner.toLowerCase()) throw new Error('Wrong GitHub account');
  const allowed = repos.filter(repo => repo.owner?.login?.toLowerCase() === owner.toLowerCase()
    && repo.fork === false && ![owner.toLowerCase(), 'readme'].includes(repo.name?.toLowerCase()));
  const ids = new Set(allowed.map(repo => repo.id));
  const days = weekdays.map(() => 0);
  const groups = viewer.contributionsCollection.commitContributionsByRepository;
  if (groups.length >= 100) throw new Error('Commit repository limit reached; refusing to publish partial counts');
  for (const group of groups) {
    if (!ids.has(group.repository.databaseId)) continue;
    if (group.contributions.pageInfo.hasNextPage) throw new Error('Commit contribution results are incomplete');
    for (const { occurredAt, commitCount } of group.contributions.nodes) {
      const stamp = Date.parse(occurredAt);
      if (!Number.isSafeInteger(commitCount) || commitCount < 0 || !Number.isFinite(stamp)) throw new Error('Invalid commit contribution');
      if (stamp >= from && stamp <= to) days[new Date(stamp).getUTCDay()] += commitCount;
    }
  }
  const languages = new Map();
  for (const { language } of allowed) {
    if (typeof language !== 'string' || !/^[\p{L}\p{N} .+#_()/-]{1,32}$/u.test(language)) continue;
    languages.set(language, (languages.get(language) ?? 0) + 1);
  }
  const ranked = [...languages].sort(([a, x], [b, y]) => y - x || a.localeCompare(b, 'en'));
  const commits = chart(weekdays.map((label, i) => [label, days[i]]), 'commit');
  const byLanguage = chart(ranked, 'repo');
  const content = ['---', '<h3 align="center"><ins><sup>FUN FACTS</sup></ins></h3>',
    '<sub>Aggregate stats across owned public and private repositories (excluding forks and this repository).</sub>',
    '**Commits by day of week**', 'Last 90 UTC calendar days · GitHub commit contributions',
    commits || '> No qualifying commit contributions returned by GitHub for this period.',
    '**Repositories by primary language**', 'GitHub-detected primary languages',
    byLanguage || '> No primary languages detected for the repositories counted.',
  ].join('\n\n');
  const start = '<!-- owned-stats:start -->';
  const end = '<!-- owned-stats:end -->';
  const fromBlock = readme.indexOf(start);
  const toBlock = readme.indexOf(end);
  if (fromBlock < 0 || toBlock < fromBlock || readme.lastIndexOf(start) !== fromBlock || readme.lastIndexOf(end) !== toBlock) {
    throw new Error('Expected one pair of aggregate chart markers');
  }
  return readme.slice(0, fromBlock + start.length) + `\n\n${content}\n\n` + readme.slice(toBlock);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [owner, path = 'README.md'] = process.argv.slice(2);
    if (!/^[a-z\d][a-z\d-]*$/i.test(owner ?? '')) throw new Error('Expected GitHub owner');
    const api = args => execFileSync('gh', ['api', ...args], {encoding: 'utf8', timeout: 60_000,
      maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
    const to = Date.now();
    const from = Math.floor(to / day) * day - 89 * day;
    const repos = api(['--paginate', '--jq', '.[] | {owner:{login:.owner.login},name,id,fork,language}',
      'user/repos?affiliation=owner&per_page=100']).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    const result = JSON.parse(api(['graphql', '-f', `query=${query}`, '-f', `from=${new Date(from).toISOString()}`,
      '-f', `to=${new Date(to).toISOString()}`]));
    if (result.errors?.length) throw new Error('GitHub contribution query failed');
    const original = readFileSync(path, 'utf8');
    const next = aggregate(original, owner, repos, result.data.viewer, from, to);
    if (original !== next) writeFileSync(path, next);
  } catch {
    console.error('Could not refresh aggregate profile stats. No API payload was logged.');
    process.exitCode = 1;
  }
}
