import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sync } from './sync-profile.mjs';

const template = 'My own introduction\n\n<!-- featured-projects:start -->\n<!-- featured-projects:end -->\n\nMy own notes\n';
const repo = (name, patch = {}) => ({name, private: false, visibility: 'public',
  owner: {login: 'dmechai'}, topics: ['profile-featured'], pushed_at: '2026-11-22T00:00:00Z', ...patch});

test('only selected public repos appear, including later pages, in stable order', () => {
  const result = sync(template, [[repo('zeta'), repo('secret', {private: true, visibility: 'private'}),
    repo('untagged', {topics: []}), repo('dmechai')], [repo('Alpha'), repo('foreign', {owner: {login: 'other'}})]], 'dmechai');
  assert.match(result, /<sup>Featured Projects<\/sup>[\s\S]*Alpha[\s\S]*zeta/);
  assert.doesNotMatch(result, /secret|untagged|\/dmechai\/dmechai|foreign/);
  assert.ok(result.startsWith('My own introduction\n'));
  assert.ok(result.endsWith('\nMy own notes\n'));
});

test('updates public metadata and removes repo after it becomes private', () => {
  const before = sync(template, [[repo('demo', {description: 'First & <b>text</b>'})]], 'dmechai');
  assert.match(before, /First &amp; &lt;b&gt;text&lt;\/b&gt;/);
  const after = sync(before, [[repo('demo', {description: 'Second', pushed_at: '2026-11-26T00:00:00Z'})]], 'dmechai');
  assert.match(after, /Second[\s\S]*Last pushed: 2026-11-26/);
  assert.equal(sync(after, [[repo('demo', {private: true})]], 'dmechai'), template);
});

test('updates account metrics and computes language shares only from selected repositories', () => {
  const base = '<!-- profile-metrics:start -->\n<!-- profile-metrics:end -->\n\n' + template;
  const selected = [[repo('demo', {stargazers_count: 7, forks_count: 2}), repo('hidden', {topics: []})]];
  const options = {account: {public_repos: 12, followers: 3}, languages: name => {
    assert.equal(name, 'demo');
    return {JavaScript: 3, Python: 1};
  }};
  const result = sync(base, selected, 'dmechai', options);
  assert.match(result, /12 PUBLIC REPOSITORIES[^\n]+3 FOLLOWERS/);
  assert.match(result, /7 stars[^\n]+2 forks/);
  assert.match(result, /JavaScript[^\n]+75\.0%\nPython[^\n]+25\.0%/);
  assert.equal(sync(result, selected, 'dmechai', options), result);
  const cleared = sync(result, [[repo('demo', {visibility: 'private'})]], 'dmechai', options);
  assert.doesNotMatch(cleared, /Featured Projects|LANGUAGES|repo\/demo|75\.0%/);
});

test('rejects bad response and ambiguous markers', () => {
  assert.throws(() => sync(template, {}, 'dmechai'), /Invalid/);
  assert.throws(() => sync(template + template, [[]], 'dmechai'), /markers/);
});
