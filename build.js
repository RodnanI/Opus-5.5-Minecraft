// Build script: inlines src/ into a single standalone HTML file (minecraft.html), then packages the Windows desktop
// edition in dist/VoxelCraft-Windows (+ a zip): the game, VoxelCraft.exe (launcher/, compiled with the C# compiler
// that comes with every Windows 10 / 11) and a readme. `node build.js --html` builds only minecraft.html.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), { spawnSync } = require('child_process');
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
if (!process.argv.includes('--html')) packageWindows(html);

// ---------------------------------------------------------------- Windows desktop edition
function packageWindows(html) {
  const L = path.join(__dirname, 'launcher'), out = path.join(__dirname, 'dist', 'VoxelCraft-Windows');
  fs.mkdirSync(path.join(out, 'game'), { recursive: true });
  fs.writeFileSync(path.join(out, 'game', 'minecraft.html'), html);
  for (const f of ['README.txt', 'Play without launcher.cmd']) fs.copyFileSync(path.join(L, f), path.join(out, f));
  const ico = path.join(__dirname, '.build', 'VoxelCraft.ico');
  fs.writeFileSync(ico, require('./launcher/make-icon').makeIco());
  // VoxelCraft.ini is not touched: it holds the player's launcher settings (VoxelCraft.exe writes it on first start)
  const windir = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows';
  const csc = ['Framework64', 'Framework'].map(d => path.join(windir, 'Microsoft.NET', d, 'v4.0.30319', 'csc.exe')).find(f => fs.existsSync(f));
  if (!csc) console.log('Skipped VoxelCraft.exe: the .NET Framework C# compiler was not found (build on Windows to get the launcher)');
  else {
    const exe = path.join(out, 'VoxelCraft.exe');
    const r = spawnSync(csc, ['/nologo', '/target:winexe', '/optimize+', '/out:' + exe, '/win32icon:' + ico, '/win32manifest:' + path.join(L, 'app.manifest'),
      '/r:System.dll', '/r:System.Drawing.dll', '/r:System.Windows.Forms.dll', '/r:System.Management.dll', path.join(L, 'VoxelCraftLauncher.cs')], { encoding: 'utf8' });
    const msg = ((r.stdout || '') + (r.stderr || '')).split(/\r?\n/).filter(l => l.trim() && !/^(This compiler|Microsoft \(R\)|for C# 5|Copyright)/.test(l)).join('\n');
    if (r.status !== 0) {
      if (/being used by another process|cannot open .* for writing/i.test(msg)) console.log('Skipped VoxelCraft.exe: it is running. Close the launcher and build again to update it.');
      else { console.error('Launcher build failed:\n' + msg); process.exit(1); }
    } else console.log('Built dist/VoxelCraft-Windows/VoxelCraft.exe (' + (fs.statSync(exe).size / 1024).toFixed(0) + ' KB)' + (msg ? '\n' + msg : ''));
  }
  // a zip to copy to another PC (without this PC's VoxelCraft.ini)
  const files = [];
  const walk = (d, rel) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f), r = rel ? rel + '/' + f : f; if (fs.statSync(p).isDirectory()) walk(p, r); else if (r !== 'VoxelCraft.ini') files.push([r, p]); } };
  walk(out, '');
  const zipPath = path.join(__dirname, 'dist', 'VoxelCraft-Windows.zip');
  fs.writeFileSync(zipPath, zip(files.map(([r, p]) => ['VoxelCraft-Windows/' + r, fs.readFileSync(p)])));
  console.log('Built dist/VoxelCraft-Windows.zip (' + (fs.statSync(zipPath).size / 1024).toFixed(0) + ' KB)');
}

// minimal zip writer (deflate, no zip64): [name, Buffer][] -> Buffer
function zip(entries) {
  const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc32 = (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const local = [], central = [];
  let off = 0;
  for (const [name, data] of entries) {
    const nm = Buffer.from(name, 'utf8'), comp = zlib.deflateRawSync(data, { level: 9 }), crc = crc32(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt16LE(time, 10); h.writeUInt16LE(date, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nm.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt16LE(time, 12); c.writeUInt16LE(date, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    local.push(h, nm, comp); central.push(c, nm); off += 30 + nm.length + comp.length;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entries.length, 8); e.writeUInt16LE(entries.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...local, cd, e]);
}
