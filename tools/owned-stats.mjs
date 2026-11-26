import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

export function aggregate(readme, owner, repos, commits) {
  const allowed = repos.filter(repo => repo.owner?.login?.toLowerCase() === owner.toLowerCase()
    && repo.fork === false && repo.name?.toLowerCase() !== owner.toLowerCase());
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
  for (const { language } of allowed) {
    if (typeof language !== 'string' || !/^[\p{L}\p{N} .+#_()/-]{1,32}$/u.test(language)) continue;
    languages.set(language, (languages.get(language) ?? 0) + 1);
  }
  const ranked = [...languages].sort(([a, x], [b, y]) => y - x || a.localeCompare(b, 'en'));
  const content = ['\n<br>\n\n---\n\n<br>\n', '### <ins><sup>FUN FACTS</sup></ins>',
    '<sub>All commits reachable from current branches, counted once per repository.</sub>',
    chart(weekdays.map((label, i) => [label, days[i]]), 'commit') || '> No commits were found in the current branch history.',
    '<sub>GitHub-detected primary languages.</sub>',
    chart(ranked, 'repo') || '> No primary languages detected for the repositories counted.',
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
    for (const repo of repos) {
      if (repo.owner?.login?.toLowerCase() !== owner.toLowerCase() || repo.fork || repo.name?.toLowerCase() === owner.toLowerCase()) continue;
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
    const [owner, path = 'README.md'] = process.argv.slice(2);
    if (!/^[a-z\d][a-z\d-]*$/i.test(owner ?? '')) throw new Error('Expected GitHub owner');
    const repos = execFileSync('gh', ['api', '--paginate', '--jq', '.[] | {owner:{login:.owner.login},name,id,fork,language}', 'user/repos?affiliation=owner&per_page=100'],
      {encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024}).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    const original = readFileSync(path, 'utf8');
    const next = aggregate(original, owner, repos, collect(owner, repos));
    if (original !== next) writeFileSync(path, next);
  } catch {
    console.error('Could not refresh aggregate profile stats. No API payload was logged.');
    process.exitCode = 1;
  }
}
