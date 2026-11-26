import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeContributionSnakes } from './contribution-snake.mjs';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const eligible = (owner, repos) => repos.filter(repo => repo.owner?.login?.toLowerCase() === owner.toLowerCase()
  && repo.fork === false && repo.name?.toLowerCase() !== owner.toLowerCase());

function chart(rows, unit, total = rows.reduce((sum, [, n]) => sum + n, 0)) {
  if (!total || !rows.length) return '';
  const width = Math.max(...rows.map(([label]) => label.length));
  return ['```text', ...rows.map(([label, n]) => {
    const share = 100 * n / total;
    const blocks = Math.round(share / 5);
    const quantity = `${n} ${unit}${n === 1 ? '' : 's'}`.padStart(unit.length + 5);
    return `${label.padEnd(width)}  ${quantity}  ${'█'.repeat(blocks)}${'░'.repeat(20 - blocks)}  ${share.toFixed(1).padStart(5)}%`;
  }), '```'].join('\n');
}

export function aggregate(readme, owner, repos, commits) {
  const allowed = eligible(owner, repos);
  const ids = new Set(allowed.map(repo => repo.id));
  const days = weekdays.map(() => 0);
  const seen = new Set();
  for (const commit of commits) {
    if (!ids.has(commit.repositoryId) || typeof commit.sha !== 'string' || !/^[0-9a-f]{40}$/.test(commit.sha)) continue;
    const key = `${commit.repositoryId}:${commit.sha}`;
    const stamp = Date.parse(commit.committedAt);
    if (seen.has(key) || !Number.isFinite(stamp)) continue;
    seen.add(key);
    days[new Date(stamp).getUTCDay()]++;
  }
  const languages = new Map();
  for (const { languages: detected } of allowed) {
    for (const [language, bytes] of Object.entries(detected ?? {})) {
      if (!/^[\p{L}\p{N} .+#_()/-]{1,32}$/u.test(language) || !Number.isSafeInteger(bytes) || bytes <= 0) continue;
      languages.set(language, (languages.get(language) ?? 0) + 1);
    }
  }
  const ranked = [...languages].sort(([a, x], [b, y]) => y - x || a.localeCompare(b, 'en'));
  const top = ranked.slice(0, 10);
  const more = ranked.slice(10);
  const content = ['### <ins><sup>FUN FACTS</sup></ins>',
    '<sub>All commits reachable from current branches, counted once per repository.</sub>',
    chart(weekdays.map((label, i) => [label, days[i]]), 'commit') || '> No commits were found in the current branch history.',
    `<sub>Languages by repository coverage: ${allowed.length} repositories. Each can count toward multiple languages.</sub>`,
    chart(top, 'repo', allowed.length) || '> No languages detected for the repositories counted.',
    ...(more.length ? [`<details>\n<summary>${more.length} more languages</summary>\n\n${chart(more, 'repo', allowed.length)}\n\n</details>`] : []),
  ].join('\n\n');
  const start = '<!-- fun-facts:start -->';
  const end = '<!-- fun-facts:end -->';
  const fromBlock = readme.indexOf(start);
  const toBlock = readme.indexOf(end);
  if (fromBlock < 0 || toBlock < fromBlock || readme.lastIndexOf(start) !== fromBlock || readme.lastIndexOf(end) !== toBlock) {
    throw new Error('Expected one pair of aggregate chart markers');
  }
  return readme.slice(0, fromBlock + start.length) + `\n\n${content}\n\n` + readme.slice(toBlock);
}

function collect(owner, repos) {
  const root = mkdtempSync(join(tmpdir(), 'profile-history-'));
  const commits = [];
  try {
    for (const repo of eligible(owner, repos)) {
      const dir = join(root, String(repo.id));
      execFileSync('git', ['clone', '--quiet', '--bare', `https://github.com/${owner}/${repo.name}.git`, dir], {timeout: 300_000, stdio: 'ignore'});
      const output = execFileSync('git', ['-C', dir, 'log', '--branches', '--format=%H%x09%cI'], {encoding: 'utf8', timeout: 120_000, maxBuffer: 64 * 1024 * 1024});
      for (const line of output.split('\n').filter(Boolean)) {
        const [sha, committedAt] = line.split('\t');
        commits.push({repositoryId: repo.id, sha, committedAt});
      }
    }
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
  return commits;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [owner, path = 'README.md', light = 'assets/snake.svg', dark = 'assets/snake-dark.svg'] = process.argv.slice(2);
    if (!/^[a-z\d][a-z\d-]*$/i.test(owner ?? '')) throw new Error('Expected GitHub owner');
    const repos = execFileSync('gh', ['api', '--paginate', '--jq', '.[] | {owner:{login:.owner.login},name,id,fork}', 'user/repos?affiliation=owner&per_page=100'],
      {encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024}).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    for (const repo of eligible(owner, repos)) {
      repo.languages = JSON.parse(execFileSync('gh', ['api', `repositories/${repo.id}/languages`],
        {encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'ignore']}));
    }
    const original = readFileSync(path, 'utf8');
    const commits = collect(owner, repos);
    const next = aggregate(original, owner, repos, commits);
    if (original !== next) writeFileSync(path, next);
    writeContributionSnakes({light, dark}, commits);
  } catch {
    console.error('Could not refresh aggregate profile stats. No API payload was logged.');
    process.exitCode = 1;
  }
}
