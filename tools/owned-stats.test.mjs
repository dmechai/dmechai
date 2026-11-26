import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate } from './owned-stats.mjs';

const readme = '<!-- fun-facts:start -->\n<!-- fun-facts:end -->';
const repo = (id, name, language, extra = {}) => ({id, owner: {login: 'demo'}, name, language, fork: false, ...extra});
const sha = n => n.toString(16).padStart(40, '0');

test('counts every current-branch commit once and excludes forks, profile, and foreign repositories', () => {
  const repos = [repo(101, 'private-fixture', 'Python', {private: true}), repo(102, 'public-fixture', 'Go'),
    repo(103, 'demo', 'Rust'), repo(104, 'fork-fixture', 'Ruby', {fork: true}), repo(105, 'external-fixture', 'Scala', {owner: {login: 'other'}})];
  const commits = [
    {repositoryId: 101, sha: sha(1), committedAt: '2024-01-02T00:00:00Z'},
    {repositoryId: 101, sha: sha(1), committedAt: '2024-01-02T00:00:00Z'},
    {repositoryId: 101, sha: sha(2), committedAt: '2020-01-03T00:00:00Z'},
    {repositoryId: 102, sha: sha(3), committedAt: '2026-11-24T00:00:00Z'},
    {repositoryId: 103, sha: sha(4), committedAt: '2026-11-24T00:00:00Z'},
    {repositoryId: 104, sha: sha(5), committedAt: '2026-11-24T00:00:00Z'},
    {repositoryId: 105, sha: sha(6), committedAt: '2026-11-24T00:00:00Z'},
  ];
  const result = aggregate(readme, 'demo', repos, commits);
  assert.match(result, /FUN FACTS[\s\S]+Tuesday\s+2 commits[^\n]+66\.7%/);
  assert.match(result, /Friday\s+1 commit[^\n]+33\.3%/);
  assert.match(result, /Python\s+1 repo[^\n]+50\.0%/);
  assert.doesNotMatch(result, /fixture|Rust|Ruby|Scala|101|102|https:/);
});

test('keeps both chart headings visible without data and preserves handwritten text', () => {
  const source = `Intro\n\n${readme}\n\nProjects`;
  const result = aggregate(source, 'demo', [], []);
  assert.match(result, /<!-- fun-facts:start -->\n\n### /);
  assert.doesNotMatch(result, /^---$/m);
  assert.match(result, /FUN FACTS[\s\S]+No commits were found/);
  assert.match(result, /No primary languages detected/);
  assert.ok(result.startsWith('Intro\n\n') && result.endsWith('\n\nProjects'));
});
