// Decode the original byte-oriented Pascal data without interpreting it as UTF-8.
// Usage: node tools/import-assets.cjs "../Part Pascal"
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const source = path.resolve(process.argv[2] || path.join(__dirname, '../../Part Pascal'));
const root = path.resolve(__dirname, '..');
function decode(file, level = false) {
  const bytes = fs.readFileSync(path.join(source, file));
  let cursor = 0;
  function header() {
    const end = bytes.indexOf(10, cursor);
    if (end < 0) throw Error(`Missing header: ${file}`);
    const value = Number(bytes.subarray(cursor, end).toString('ascii').trim());
    cursor = end + 1;
    return value;
  }
  const version = header(), width = header(), height = header();
  if (version !== 100 || !width || !height) throw Error(`Invalid header: ${file}`);
  const layers = [];
  for (let l = 0; l < (level ? 3 : 1); l++) {
    const pixels = Array(width * height).fill(0);
    // Sprite files contain columns; level files contain rows.
    const outer = level ? height : width, inner = level ? width : height;
    for (let a = 0; a < outer; a++) {
      for (let b = 0; b < inner; b++) {
        if (cursor >= bytes.length) throw Error(`Truncated data: ${file}`);
        pixels[level ? a * width + b : b * width + a] = bytes[cursor++];
      }
      if (bytes[cursor] === 13) cursor++;
      if (bytes[cursor++] !== 10) throw Error(`Invalid row boundary: ${file}`);
    }
    layers.push(pixels);
  }
  if (cursor !== bytes.length) throw Error(`Trailing bytes: ${file}`);
  return level ? {width, height, layers} : {width, height, pixels: layers[0]};
}
const sprites = {};
const groups = {man:4, bg:11, cross:2, rck:1, exp:3, smk:3, bld:3, lmb:3, lqd:9, bdy:6, obj:7, rel:5, bag:1};
const files = fs.readdirSync(source);
for (const [prefix, count] of Object.entries(groups)) {
  for (let i = 1; i <= count; i++) {
    const name = `${prefix}${i}`;
    const file = files.find(f => f.toLowerCase() === name + '.dat');
    if (!file) throw Error(`Missing ${name}.dat`);
    sprites[name] = decode(file);
  }
}
for (let i = 0; i < 10; i++) sprites[`n${i}`] = decode(files.find(f => f.toLowerCase() === `n${i}.dat`));
const level = decode(files.find(f => f.toLowerCase() === 'level1.dat'), true);
if (level.layers[0].some(v => v < 1 || v > 11)) throw Error('Invalid level tile');
if (level.layers[2].some(v => v > 7)) throw Error('Invalid pickup');
const manifest = [];
fs.mkdirSync(path.join(root, 'original-data'), {recursive:true});
for (const file of files.filter(f => /\.dat$/i.test(f))) {
  const contents = fs.readFileSync(path.join(source, file));
  fs.writeFileSync(path.join(root, 'original-data', file), contents);
  manifest.push({file, bytes:contents.length, sha256:crypto.createHash('sha256').update(contents).digest('hex')});
}
const result = {sprites, level};
fs.writeFileSync(path.join(root, 'assets.js'), '// Generated from original .DAT files by tools/import-assets.cjs.\n' +
  '(function(root){const data=' + JSON.stringify(result) + ';if(typeof module!=="undefined"&&module.exports)module.exports=data;else root.MinkAssets=data;})(globalThis);\n');
fs.writeFileSync(path.join(root, 'original-data', 'manifest.json'), JSON.stringify(manifest,null,2)+'\n');
console.log(`Imported ${Object.keys(sprites).length} sprites, ${level.width}x${level.height} level, and preserved ${manifest.length} original files.`);
