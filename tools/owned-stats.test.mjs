import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate } from './owned-stats.mjs';

const readme = '<!-- owned-stats:start -->\n<!-- owned-stats:end -->';
const from = Date.parse('2026-11-22T00:00:00Z');
const to = Date.parse('2026-11-28T23:59:59Z');
const repo = (id, name, language, extra = {}) => ({id, owner: {login: 'demo'}, name, language, fork: false, ...extra});
const group = (id, commitCount, hasNextPage = false) => ({repository: {databaseId: id}, contributions: {
  nodes: [{occurredAt: '2026-11-24T01:00:00Z', commitCount}], pageInfo: {hasNextPage},
}});
const viewer = groups => ({login: 'demo', contributionsCollection: {commitContributionsByRepository: groups}});

test('combines public and private repositories without emitting repository identifiers', () => {
  const repos = [repo(101, 'private-fixture', 'Python', {private: true}), repo(102, 'public-fixture', 'Go'),
    repo(103, 'demo', 'Rust'), repo(104, 'fork-fixture', 'Ruby', {fork: true}),
    repo(105, 'external-fixture', 'Scala', {owner: {login: 'other'}})];
  const result = aggregate(readme, 'demo', repos, viewer([group(101, 2), group(102, 1), group(103, 100), group(104, 100)]), from, to);
  assert.match(result, /Tuesday\s+3 commits[^\n]+100\.0%/);
  assert.match(result, /Python\s+1 repo[^\n]+50\.0%/);
  assert.match(result, /Go\s+1 repo[^\n]+50\.0%/);
  assert.doesNotMatch(result, /fixture|Rust|Ruby|Scala|101|102|https:/);
});

test('keeps both chart headings visible without data and preserves handwritten text', () => {
  const source = `Intro\n\n${readme}\n\nProjects`;
  const result = aggregate(source, 'demo', [], viewer([]), from, to);
  assert.match(result, /Commits by day of week[\s\S]+No qualifying commit contributions/);
  assert.match(result, /Repositories by primary language[\s\S]+No primary languages detected/);
  assert.ok(result.startsWith('Intro\n\n'));
  assert.ok(result.endsWith('\n\nProjects'));
});

test('refuses an incomplete contribution result or wrong account', () => {
  assert.throws(() => aggregate(readme, 'demo', [repo(101, 'private-fixture', 'Go')], viewer([group(101, 2, true)]), from, to), /incomplete/);
  assert.throws(() => aggregate(readme, 'other', [], viewer([]), from, to), /Wrong GitHub account/);
});
