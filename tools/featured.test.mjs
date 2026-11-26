import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featured } from './featured.mjs';

const readme = 'Before\n<!-- featured-projects:start -->\n<!-- featured-projects:end -->\nAfter';
const repo = (name, stars, extra = {}) => ({name, owner: {login: 'demo'}, private: false, fork: false, stargazers_count: stars, forks_count: 0, description: extra.description ?? '', ...extra});

test('selects the six highest-ranked public repositories and hides private ones', () => {
  const repos = [repo('low', 1), repo('private-one', 100, {private: true}), repo('demo', 8), repo('forked', 100, {fork: true}),
    repo('top', 9, {description: 'A <project>'}), repo('tied-b', 4), repo('tied-a', 4), repo('foreign', 100, {owner: {login: 'other'}}),
    repo('seventh', 2), repo('sixth', 3), repo('fifth', 3), repo('fourth', 5)];
  const result = featured(readme, 'demo', repos);
  assert.match(result, /top[\s\S]+demo[\s\S]+fourth[\s\S]+tied-a[\s\S]+tied-b[\s\S]+fifth/);
  assert.doesNotMatch(result, /private-one|forked|foreign|seventh|low|待选择/);
  assert.equal([...result.matchAll(/<tr>/g)].length, 3);
  assert.equal([...result.matchAll(/<td width="50%" align="left" valign="top">/g)].length, 6);
  assert.ok(result.startsWith('Before\n') && result.endsWith('\nAfter'));
});

test('renders one compact left-aligned profile entry with verified details', () => {
  const result = featured(readme, 'demo', [repo('demo', 0, {language: 'JavaScript'})]);
  assert.match(result, /### <ins><sup>FEATURED PROJECTS<\/sup><\/ins>/);
  assert.match(result, /<div align="left">\n<table>\n<tr>\n<td width="400" align="left" valign="top">\n<strong><a href="https:\/\/github\.com\/demo\/demo">demo/);
  assert.equal([...result.matchAll(/<td\b/g)].length, 1);
  assert.match(result, /<sub>The source for this GitHub profile README\.<\/sub>/);
  assert.deepEqual([...result.matchAll(/<img alt="([^"]+)"/g)].map(match => match[1]), ['JavaScript', 'Activity Charts', 'Contribution Snake']);
  assert.equal([...result.matchAll(/<li>/g)].length, 2);
  assert.doesNotMatch(result, /^---$|View profile|0 Forks|⚖/m);
  assert.equal(featured(result, 'demo', [repo('demo', 0, {language: 'JavaScript'})]), result);
});

test('uses the public description and license when available', () => {
  const result = featured(readme, 'demo', [repo('public-tool', 5, {language: 'Python', description: 'A <tool> & examples', license: {spdx_id: 'MIT'}})]);
  assert.match(result, /<sub>A &lt;tool&gt; &amp; examples<\/sub>/);
  assert.deepEqual([...result.matchAll(/<img alt="([^"]+)"/g)].map(match => match[1]), ['5 Stars', 'Python', 'MIT']);
  assert.doesNotMatch(result, /<li>|View profile/);
});

test('prioritizes nonzero stars and forks, and uses public topics when there is room', () => {
  const images = new Map();
  const result = featured(readme, 'demo', [repo('popular', 8, {forks_count: 2, language: 'Python', topics: ['cli']}),
    repo('small', 0, {language: 'Go', license: {spdx_id: 'NOASSERTION'}, topics: ['cli', 'api']})], images);
  assert.deepEqual([...result.matchAll(/<img alt="([^"]+)"/g)].map(match => match[1]), ['8 Stars', '2 Forks', 'Python', 'Go', 'cli', 'api']);
  assert.equal(images.size, 6);
  assert.ok([...images.values()].includes('https://img.shields.io/badge/Python-3776ab?style=flat-square&logo=python&logoColor=white'));
});

test('keeps an odd project in the left column without a placeholder', () => {
  const result = featured(readme, 'demo', [repo('one', 3), repo('two', 2), repo('three', 1)]);
  const rows = [...result.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
  assert.deepEqual(rows.map(([, row]) => [...row.matchAll(/<td\b/g)].length), [2, 1]);
  assert.match(rows[1][1], /\/three"/);
});

test('hides the section when no public repository exists', () => {
  assert.equal(featured(readme, 'demo', [repo('secret', 5, {private: true})]), 'Before\n<!-- featured-projects:start -->\n<!-- featured-projects:end -->\nAfter');
});
