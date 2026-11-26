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

export function snakeRoute(cells) {
  const route = [[-1, 0]];
  const key = ([x, y]) => `${x},${y}`;
  const food = new Set(cells.flatMap((level, i) => level ? [key([Math.floor(i / DAYS), i % DAYS])] : []));
  if (!food.size) return route;

  function advance(targets) {
    const start = route.at(-1);
    const queue = [{point: start, parent: null}];
    const seen = new Set([key(start)]);
    if (route.length > 1) seen.add(key(route.at(-2)));
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i];
      const [x, y] = node.point;
      if (targets.has(key(node.point))) {
        const path = [];
        for (let step = node; step.parent; step = step.parent) path.push(step.point);
        route.push(...path.reverse());
        return key(node.point);
      }
      for (const point of [[x + 1, y], [x, y + 1], [x, y - 1], [x - 1, y]]) {
        const [nx, ny] = point;
        const id = key(point);
        if (nx < -1 || nx >= WEEKS || ny < 0 || ny >= DAYS || seen.has(id)) continue;
        seen.add(id);
        queue.push({point, parent: node});
      }
    }
    throw new Error('Unreachable contribution cell');
  }

  while (food.size) food.delete(advance(food));
  advance(new Set([key(route[0])]));
  return route;
}

function svg(cells, theme) {
  const cell = 16;
  const step = 95;
  const route = snakeRoute(cells);
  const firstVisit = new Map();
  route.forEach(([x, y], i) => {
    const id = `${x},${y}`;
    if (!firstVisit.has(id)) firstVisit.set(id, i);
  });
  const duration = Math.max(1, route.length - 1) * step;
  const dark = theme === 'dark';
  const colors = dark ? ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'] : ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
  const rects = [];
  const styles = [];
  for (let x = 0; x < WEEKS; x++) {
    for (let y = 0; y < DAYS; y++) {
      const color = cells[x * DAYS + y];
      const id = `c${x * DAYS + y}`;
      if (color) {
        const eatenAt = firstVisit.get(`${x},${y}`);
        const t = (100 * eatenAt / (route.length - 1)).toFixed(5);
        styles.push(`@keyframes ${id}{from{fill:${colors[color]}}${t}%,to{fill:${colors[0]}}}.c.${id}{fill:${colors[color]};animation-name:${id}}`);
      }
      rects.push(`<rect class="c${color ? ` ${id}` : ''}" x="${x * cell + 2}" y="${y * cell + 2}" width="12" height="12" rx="2"/>`);
    }
  }
  const path = `M${route.map(([x, y]) => `${x * cell + 8},${y * cell + 8}`).join('L')}`;
  const body = cells.some(Boolean) ? Array.from({length: 7}, (_, i) => {
    const lag = (6 - i) * 37;
    const color = dark ? (i === 6 ? '#e6edf3' : '#aeb8c2') : (i === 6 ? '#343a42' : '#5f6368');
    const motion = `<animateMotion dur="${duration}ms" begin="-${duration - lag}ms" repeatCount="indefinite" path="${path}"/>`;
    return `<circle class="s" r="${i === 6 ? 6.3 : 3.8 + i * 0.3}" fill="${color}">${motion}</circle>`;
  }).join('') : '';
  return `<svg viewBox="-16 -4 880 136" width="880" height="136" xmlns="http://www.w3.org/2000/svg"><style>.c{fill:${colors[0]};stroke:${dark ? '#ffffff0f' : '#1b1f230f'};animation-duration:${duration}ms;animation-timing-function:steps(1,end);animation-iteration-count:infinite}${styles.join('')}@media(prefers-reduced-motion:reduce){.c{animation:none}.s{display:none}}</style>${rects.join('')}${body}</svg>`;
}

export function writeContributionSnakes(paths, commits, now = Date.now()) {
  const {cells, commits: counted} = contributionGrid(commits, now);
  const images = {light: svg(cells, 'light'), dark: svg(cells, 'dark')};
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
