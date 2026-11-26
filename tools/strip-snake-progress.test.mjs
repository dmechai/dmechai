import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripProgress } from './strip-snake-progress.mjs';

test('removes the progress rectangles but preserves the snake and grid', () => {
  const grid = '<rect class="c c0"/>';
  const snake = '<rect class="s s0"/>';
  const svg = `<svg>${grid}<rect class="u u0" width="7"/>${snake}</svg>`;
  assert.equal(stripProgress(svg), `<svg>${grid}${snake}</svg>`);
  assert.equal(stripProgress(stripProgress(svg)), stripProgress(svg));
  assert.throws(() => stripProgress('<svg></svg>'), /Unexpected/);
});
