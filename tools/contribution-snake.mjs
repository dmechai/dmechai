import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const WEEKS = 53;
const DAYS = 7;

function dayIndex(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
}

export function contributionGrid(commits, now = Date.now()) {
  const today = dayIndex(now);
  const start = today - ((today + 4) % DAYS) - (WEEKS - 1) * DAYS;
  const counts = new Uint16Array(WEEKS * DAYS);
  const seen = new Set();
  for (const commit of commits) {
    const key = `${commit.repositoryId}:${commit.sha}`;
    const index = dayIndex(commit.committedAt);
    if (seen.has(key) || index === null || index < start || index > today) continue;
    seen.add(key);
    counts[index - start]++;
  }
  const positive = [...counts].filter(Boolean).sort((a, b) => a - b);
  const level = count => {
    if (!count || !positive.length) return 0;
    const rank = positive.filter(value => value < count).length;
    return 1 + Math.min(3, Math.floor(4 * rank / positive.length));
  };
  const cells = [...counts].map(level);
  return {start, today, cells, commits: counts.reduce((sum, count) => sum + count, 0)};
}

function animation(cells) {
  const route = [];
  for (let x = 0; x < WEEKS; x++) {
    for (let offset = 0; offset < DAYS; offset++) {
      const y = x % 2 ? DAYS - 1 - offset : offset;
      if (cells[x * DAYS + y]) route.push({x, y, color: cells[x * DAYS + y]});
    }
  }
  route.push({x: WEEKS, y: route.at(-1)?.x % 2 ? 0 : DAYS - 1, color: 0});
  return route;
}

function svg(cells, snake) {
  const cell = 16;
  const dot = 12;
  const radius = 2;
  const margin = (cell - dot) / 2;
  const route = animation(cells);
  const duration = Math.max(1, route.length - 1) * 140;
  const colors = {light: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'], dark: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']};
  const rects = [];
  const styles = [];
  for (let x = 0; x < WEEKS; x++) {
    for (let y = 0; y < DAYS; y++) {
      const eatenAt = route.findIndex(step => step.x === x && step.y === y);
      const id = eatenAt >= 0 ? `c${eatenAt.toString(36)}` : '';
      const color = cells[x * DAYS + y];
      if (id) {
        const t = eatenAt / (route.length - 1);
        styles.push(`@keyframes ${id}{${((t - 0.0001) * 100).toFixed(4)}%{fill:var(--c${color})}${((t + 0.0001) * 100).toFixed(4)}%{fill:var(--ce)}100%{fill:var(--ce)}}`);
      }
      rects.push(`<rect class="c${id ? ` ${id}` : ''}" x="${x * cell + margin}" y="${y * cell + margin}" width="${dot}" height="${dot}" rx="${radius}" ry="${radius}"${id ? ` style="fill:var(--c${color});animation-name:${id}"` : ''}/>`);
    }
  }
  const points = route.map(step => `${step.x * cell + cell / 2},${step.y * cell + cell / 2}`);
  const snakePath = points.length > 1 ? `M${points.join('L')}` : '';
  return `<svg viewBox="-16 -32 ${cell * (WEEKS + 2)} ${cell * (DAYS + 5)}" width="${cell * (WEEKS + 2)}" height="${cell * (DAYS + 5)}" xmlns="http://www.w3.org/2000/svg"><style>:root{--ce:${colors.light[0]};--cb:#1b1f230f;--cs:${snake};${colors.light.slice(1).map((color, i) => `--c${i + 1}:${color}`).join(';')}}@media(prefers-color-scheme:dark){:root{--ce:${colors.dark[0]};--cb:#ffffff0f;--cs:${snake};${colors.dark.slice(1).map((color, i) => `--c${i + 1}:${color}`).join(';')}}}.c{shape-rendering:geometricPrecision;fill:var(--ce);stroke:var(--cb);stroke-width:1px;animation:none ${duration}ms linear infinite}.s{fill:none;stroke:var(--cs);stroke-width:8;stroke-linecap:round;stroke-linejoin:round}${styles.join('')}</style>${rects.join('')}<path class="s" d="${snakePath}" pathLength="1" stroke-dasharray="0.035 1" stroke-dashoffset="0"><animate attributeName="stroke-dashoffset" values="0;-1" dur="${duration}ms" repeatCount="indefinite"/></path></svg>`;
}

export function writeContributionSnakes(paths, commits, now = Date.now()) {
  const {cells, commits: counted} = contributionGrid(commits, now);
  const images = {light: svg(cells, '#5f6368'), dark: svg(cells, '#bbc2c9')};
  for (const [theme, path] of Object.entries(paths)) writeFileSync(path, images[theme]);
  return {days: cells.filter(Boolean).length, commits: counted};
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
  } finally { rmSync(root, {recursive: true, force: true}); }
  return commits;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [owner, light = 'assets/snake.svg', dark = 'assets/snake-dark.svg'] = process.argv.slice(2);
  if (!/^[a-z\d][a-z\d-]*$/i.test(owner ?? '')) throw new Error('Expected GitHub owner');
  const repos = execFileSync('gh', ['api', '--paginate', '--jq', '.[] | {owner:{login:.owner.login},name,id,fork}', 'user/repos?affiliation=owner&per_page=100'], {encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024}).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const result = writeContributionSnakes({light, dark}, collect(owner, repos));
  console.log(`Updated contribution activity: ${result.days} active days, ${result.commits} commits`);
}
