import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contributionGrid, snakeRoute, writeContributionSnakes } from './contribution-snake.mjs';

test('visits every calendar cell with adjacent steps and closes the loop', () => {
  const route = snakeRoute();
  assert.deepEqual(route[0], route.at(-1));
  assert.equal(new Set(route.slice(1, 1 + 53 * 7).map(point => point.join(','))).size, 53 * 7);
  for (let i = 1; i < route.length; i++) {
    assert.equal(Math.abs(route[i][0] - route[i - 1][0]) + Math.abs(route[i][1] - route[i - 1][1]), 1);
  }
});

const commit = (day, id = 'a', sha = 'a') => ({repositoryId: id, sha: sha.repeat(40), committedAt: `${day}T12:00:00Z`});

test('counts every repository day in the latest 53 weeks once per commit', () => {
  const now = Date.parse('2026-11-26T22:00:00Z');
  const grid = contributionGrid([commit('2026-11-26', 'a', 'a'), commit('2026-11-26', 'b', 'b'), commit('2025-11-24', 'a', 'c'), commit('2025-11-22'), commit('2024-01-01')], now);
  assert.equal(grid.cells.filter(Boolean).length, 2);
  assert.equal(grid.commits, 3);
  const today = Math.floor(Date.UTC(2026, 10, 26) / 86_400_000);
  assert.ok(grid.cells[today - grid.start] >= 1);
});

test('writes both themes with one animated cell per active day', () => {
  const root = mkdtempSync(join(tmpdir(), 'snake-'));
  const paths = {light: join(root, 'light.svg'), dark: join(root, 'dark.svg')};
  const result = writeContributionSnakes(paths, [commit('2026-11-26', 'a', 'a'), commit('2026-11-25', 'a', 'b')], Date.parse('2026-11-26T00:00:00Z'));
  const light = readFileSync(paths.light, 'utf8');
  const dark = readFileSync(paths.dark, 'utf8');
  assert.equal(result.days, 2);
  assert.equal([...light.matchAll(/animation-name:c/g)].length, 2);
  assert.match(light, /#9be9a8/);
  assert.match(dark, /#0e4429/);
  assert.doesNotMatch(light, /<rect class="u |repository|github.com/);
  rmSync(root, {recursive: true, force: true});
});
