import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const screenshots = [
  'dashboard.jpg',
  'leads.jpg',
  'new-lead.jpg',
  'users.jpg'
];

function jpegDimensions(buffer) {
  assert.equal(buffer[0], 0xff);
  assert.equal(buffer[1], 0xd8);
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7].includes(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }
    offset += 2 + length;
  }
  throw new Error('JPEG dimensions are missing.');
}

for (const name of screenshots) {
  const file = path.join(root, 'docs', 'assets', 'screenshots', name);
  const buffer = fs.readFileSync(file);
  const {width, height} = jpegDimensions(buffer);
  assert.ok(width >= 1200 && height >= 800, `${name} is too small (${width}x${height})`);
  assert.ok(buffer.length < 1_000_000, `${name} is unexpectedly large`);
}

const video = fs.readFileSync(
  path.join(root, 'docs', 'assets', 'product-tour.mp4')
);
assert.equal(video.subarray(4, 8).toString('ascii'), 'ftyp', 'Tour is not MP4');
assert.ok(video.length > 50_000 && video.length < 5_000_000);
const atoms = video.toString('latin1');
assert.ok(
  atoms.indexOf('moov') >= 0 && atoms.indexOf('moov') < atoms.indexOf('mdat'),
  'MP4 must be optimized for progressive web playback'
);

console.log('✓ Product screenshots and fast-start MP4 pass media checks.');
