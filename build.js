// Build script: inlines src/ into a single standalone HTML file (minecraft.html)
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, 'src');
function cat(dir) {
  return fs.readdirSync(path.join(src, dir)).filter(f => f.endsWith('.js')).sort()
    .map(f => `// ===== ${dir}/${f} =====\n` + fs.readFileSync(path.join(src, dir, f), 'utf8')).join('\n');
}
const parts = { CSS: fs.readFileSync(path.join(src, 'style.css'), 'utf8'), SHARED: cat('shared'), WORKER: cat('worker'), MAIN: cat('main') };
fs.mkdirSync(path.join(__dirname, '.build'), { recursive: true });
for (const k of ['SHARED', 'WORKER', 'MAIN']) {
  if (/<\/script/i.test(parts[k])) { console.error('ERROR: </script found in ' + k); process.exit(1); }
  fs.writeFileSync(path.join(__dirname, '.build', k.toLowerCase() + '.js'), parts[k]);
}
// combined files catch cross-script global redeclarations (both scripts share one global scope)
fs.writeFileSync(path.join(__dirname, '.build', 'combined.js'), parts.SHARED + '\n' + parts.MAIN);
fs.writeFileSync(path.join(__dirname, '.build', 'combined_worker.js'), parts.SHARED + '\n' + parts.WORKER);
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
for (const k of Object.keys(parts)) html = html.replace('/*@' + k + '*/', () => parts[k]);
fs.writeFileSync(path.join(__dirname, 'minecraft.html'), html);
console.log('Built minecraft.html (' + (html.length / 1024).toFixed(1) + ' KB)');
