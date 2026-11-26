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
  assert.ok(result.startsWith('Before\n') && result.endsWith('\nAfter'));
});

test('hides the section when no public repository exists', () => {
  assert.equal(featured(readme, 'demo', [repo('secret', 5, {private: true})]), 'Before\n<!-- featured-projects:start -->\n<!-- featured-projects:end -->\nAfter');
});
