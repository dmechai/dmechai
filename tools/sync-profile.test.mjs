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

test('renders only explicitly configured tech badges and hides empty groups', () => {
  const base = template + '<!-- tech-stack:start -->\n<!-- tech-stack:end -->\n';
  const result = sync(base, [[]], 'dmechai', {stack: {favorites: ['C++'], other: {Frontend: [], Backend: ['Node.js']}}});
  assert.match(result, /MY TECH STACK[\s\S]*PERSONAL FAVS[\s\S]*C%2B%2B-444444/);
  assert.match(result, /<details>[\s\S]*OTHER TECHNOLOGIES USED[\s\S]*Node\.js/);
  assert.doesNotMatch(result, /Frontend/);
  assert.equal(sync(result, [[]], 'dmechai', {stack: {favorites: [], other: {}}}), base);
});

test('counts only unique recent pushes to still-public owned repos in UTC', () => {
  const base = template + '<!-- fun-facts:start -->\n<!-- fun-facts:end -->\n';
  const event = (id, created_at, repoId = 10) => ({id, created_at, type: 'PushEvent', public: true, repo: {id: repoId}});
  const monday = event('1', '2026-11-23T06:00:00Z');
  const events = [monday, monday, event('2', '2026-11-24T00:00:00Z'),
    event('3', '2026-10-10T00:00:00Z'), event('4', '2026-11-25T00:00:00Z', 20),
    {...event('5', '2026-11-25T00:00:00Z'), public: false}];
  const options = {events, now: Date.parse('2026-11-27T00:00:00Z')};
  const result = sync(base, [[repo('demo', {id: 10, language: 'Python'}), repo('hidden', {id: 20, private: true})]], 'dmechai', options);
  assert.match(result, /UTC · 2 recorded/);
  assert.match(result, /Morning +1[^\n]+50\.0%/);
  assert.match(result, /Tuesday +1[^\n]+50\.0%/);
  assert.match(result, /Primary language by featured repository[\s\S]*Python[^\n]+100\.0%/);
  assert.equal(sync(result, [[]], 'dmechai', options), base);
});

test('rejects bad response and ambiguous markers', () => {
  assert.throws(() => sync(template, {}, 'dmechai'), /Invalid/);
  assert.throws(() => sync(template + template, [[]], 'dmechai'), /markers/);
});
