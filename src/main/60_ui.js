// ============================================================================
//  UI: HUD, menus, settings, container screens (DOM based)
// ============================================================================
const PIX = {
  heart: ['.XX...XX.', 'XRRX.XRRX', 'XRWRXRRRX', 'XRRRRRRRX', '.XRRRRRX.', '..XRRRX..', '...XRX...', '....X....'],
  food: ['......XX.', '.....XBBX', '....XBBX.', '.XXXBBX..', 'XMMMXX...', 'XMMMMX...', 'XMMMMX...', '.XMMX....', '..XX.....'],
  armor: ['.XX...XX.', 'XGGXXXGGX', 'XGGGGGGGX', '.XGGGGGX.', '.XGGGGGX.', '.XGGGGGX.', '.XGGGGGX.', '..XXXXX..'],
  bubble: ['..XXXX...', '.XWBBBX..', 'XWBBBBBX.', 'XBBBBBBX.', 'XBBBBBBX.', '.XBBBBX..', '..XXXX...'],
};
function pixIcon(rows, map, half, empty) {
  const c = document.createElement('canvas'); c.width = 9; c.height = 9; const g = c.getContext('2d');
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { let ch = r[x]; if (ch === '.') continue; if (empty && ch !== 'X') ch = 'E'; if (half && x >= 5 && ch !== 'X') ch = 'E'; const col = map[ch]; if (!col) continue; g.fillStyle = col; g.fillRect(x, y, 1, 1); } });
  return c.toDataURL();
}
const FONT5 = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'], E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'], O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'], V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'], X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
};
const SPLASHES = ['Now with 100% more cubes!', 'Procedurally painted!', 'No pixels were copied!', 'Mind the Boomcaps!', 'Ember Imps hate snowballs!', 'Try the nether!', 'Dig straight down? Maybe not.', 'Runs on a toaster!', 'Shaders included!', 'Sentinels are friends!', 'Infinite-ish worlds!', 'Punch trees, make friends!', 'Mobile ready!', 'Also try fishing! (not included)', 'Made of 99% noise!'];
class UI {
  constructor(game) {
    this.game = game;
    this.root = $('#ui');
    this.open = null; this.cursor = null; this.debug = false; this.chatOpen = false;
    this.msgs = [];
    this.icons = {
      hf: pixIcon(PIX.heart, { X: '#300', R: '#e3222a', W: '#ffb0b0' }), hh: pixIcon(PIX.heart, { X: '#300', R: '#e3222a', W: '#ffb0b0', E: '#3a1616' }, true), he: pixIcon(PIX.heart, { X: '#300', E: '#3a1616' }, false, true),
      ff: pixIcon(PIX.food, { X: '#301800', B: '#f0e8d8', M: '#b8632a' }), fh: pixIcon(PIX.food, { X: '#301800', B: '#f0e8d8', M: '#b8632a', E: '#3a2616' }, true), fe: pixIcon(PIX.food, { X: '#301800', E: '#3a2616' }, false, true),
      af: pixIcon(PIX.armor, { X: '#222', G: '#d8d8d8' }), ah: pixIcon(PIX.armor, { X: '#222', G: '#d8d8d8', E: '#444' }, true), ae: pixIcon(PIX.armor, { X: '#222', E: '#444' }, false, true),
      bf: pixIcon(PIX.bubble, { X: '#124', W: '#fff', B: '#5aa0ff' }),
    };
    const st = document.createElement('style');
    st.textContent = `.i-hf{background-image:url(${this.icons.hf})}.i-hh{background-image:url(${this.icons.hh})}.i-he{background-image:url(${this.icons.he})}.i-ff{background-image:url(${this.icons.ff})}.i-fh{background-image:url(${this.icons.fh})}.i-fe{background-image:url(${this.icons.fe})}.i-af{background-image:url(${this.icons.af})}.i-ah{background-image:url(${this.icons.ah})}.i-ae{background-image:url(${this.icons.ae})}.i-bf{background-image:url(${this.icons.bf})}`;
    document.head.appendChild(st);
    this.buildHUD();
    ICONS.onReady = () => this.onIconsReady();
    this.cursorEl = h('div', { id: 'cursor-item', class: 'slot bare' });
    this.tipEl = h('div', { id: 'tooltip' });
    document.body.append(this.cursorEl, this.tipEl);
    document.addEventListener('pointermove', (e) => { this.mx = e.clientX; this.my = e.clientY; this.moveCursor(); });
    window.addEventListener('resize', () => this.layout());
    this.layout();
  }
  layout() {
    const gs = SETTINGS.guiScale || 1;
    const s = Math.floor(Math.max(26, Math.min(window.innerWidth / 11.5, window.innerHeight / 10.8, 46)) * gs);
    document.documentElement.style.setProperty('--s', s + 'px');
    const hb = Math.floor(Math.max(28, Math.min(window.innerWidth / 11, 48)) * gs * (IS_TOUCH ? 1 : 0.92));
    document.documentElement.style.setProperty('--hb', hb + 'px');
    const so = Math.round(s * 1.3);
    document.documentElement.style.setProperty('--so', so + 'px');
    this.slotPx = s; this.hbPx = hb; this.soPx = so;
    if (this.hud) this.renderHotbar(true);
  }
  // ------------------------------------------------------------------ icons
  // icon edge length for a slot: whole pixels, same parity as the slot so it sits exactly centred
  iconPx(slot) { let n = Math.round(slot * 0.8); if ((slot - n) & 1) n--; return Math.max(8, n); }
  iconStyle(el, id, css) {
    const i = ICONS.index.get(id);
    if (i === undefined) { el.style.backgroundImage = 'none'; return; }
    const N = Math.max(8, Math.round(css * (window.devicePixelRatio || 1)));
    let a = iconAtlas(N);
    if (!a.ready) a = iconAtlasFallback(N);
    if (!a) { el.style.backgroundImage = 'none'; return; }
    const k = css / a.N, x = (i % a.cols) * a.cell + ICON_GUTTER, y = Math.floor(i / a.cols) * a.cell + ICON_GUTTER;
    el.style.backgroundImage = `url(${a.url})`;
    el.style.backgroundSize = `${a.w * k}px ${a.h * k}px`;
    el.style.backgroundPosition = `${-x * k}px ${-y * k}px`;
  }
  // build the atlases for the current slot sizes (called at boot, before any inventory is shown)
  prepareIcons() {
    const dpr = window.devicePixelRatio || 1;
    const recs = [...new Set([this.slotPx, this.hbPx, this.soPx].map(s => Math.max(8, Math.round(this.iconPx(s) * dpr))))].map(N => iconAtlas(N));
    return new Promise(res => { const chk = () => recs.every(r => r.ready) ? res() : setTimeout(chk, 16); chk(); });
  }
  onIconsReady() {
    this.renderHotbar(true);
    if (this.scr) this.refresh();
    if (this.scr && this.scr.onRefresh) this.scr.onRefresh();
  }
  renderSlot(el, stack, size) {
    if (el._out) size = this.soPx;
    if (!el._ic) { el._ic = h('div', { class: 'ic' }); el._cnt = h('span', { class: 'cnt' }); el._dur = h('div', { class: 'dur' }, h('div')); el.append(el._ic, el._cnt, el._dur); }
    const ip = this.iconPx(size);
    const key = stack ? stack.id + ':' + stack.n + ':' + (stack.d || 0) + ':' + size + ':' + ICONS.gen : 'e' + size;
    if (el._key === key) return; el._key = key;
    if (el._icPx !== ip) { el._icPx = ip; const st = el._ic.style, o = (size - ip) / 2; st.width = st.height = ip + 'px'; st.left = st.top = o + 'px'; }
    if (!stack) { el._ic.style.backgroundImage = 'none'; el._cnt.textContent = ''; el._dur.style.display = 'none'; return; }
    this.iconStyle(el._ic, stack.id, ip);
    el._cnt.textContent = stack.n > 1 ? stack.n : '';
    const d = ITEMS[stack.id];
    if (d && d.dur && stack.d > 0) { el._dur.style.display = 'block'; const f = 1 - stack.d / d.dur; el._dur.firstChild.style.width = (f * 100) + '%'; el._dur.firstChild.style.background = `hsl(${f * 120},90%,45%)`; }
    else el._dur.style.display = 'none';
  }
  // ------------------------------------------------------------------ HUD
  buildHUD() {
    const hud = this.hud = h('div', { id: 'hud' });
    this.cross = h('div', { id: 'crosshair' });
    this.hotbar = h('div', { id: 'hotbar' });
    this.hbSlots = [];
    for (let i = 0; i < 9; i++) { const s = h('div', { class: 'hslot' }); s.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (this.game.player) { if (this.game.player.sel === i && e.pointerType === 'touch') { this.hbHold = setTimeout(() => this.game.dropHeld(true), 500); } this.game.player.sel = i; this.onSlotChange(); } }); s.addEventListener('pointerup', () => clearTimeout(this.hbHold)); this.hotbar.appendChild(s); this.hbSlots.push(s); }
    this.hbSel = h('div', { id: 'hbsel' }); this.hotbar.appendChild(this.hbSel);
    const row = (cls) => { const r = h('div', { class: 'bar ' + cls }); r.items = []; for (let i = 0; i < 10; i++) { const s = h('span', { class: 'bi' }); r.appendChild(s); r.items.push(s); } return r; };
    this.hearts = row('hearts'); this.foods = row('foods'); this.armorRow = row('armor'); this.bubbles = row('bubbles');
    this.xpBar = h('div', { id: 'xpbar' }, this.xpFill = h('div', { class: 'fill' }), this.xpLvl = h('div', { class: 'lvl' }));
    this.stats = h('div', { id: 'stats' }, h('div', { class: 'col left' }, this.armorRow, this.hearts), h('div', { class: 'col right' }, this.bubbles, this.foods));
    this.itemName = h('div', { id: 'itemname' });
    this.msgBox = h('div', { id: 'msgs' });
    this.dbg = h('pre', { id: 'debug' });
    this.fps = h('div', { id: 'fps' });
    this.fireOv = h('div', { id: 'fireov' });
    this.sleepOv = h('div', { id: 'sleepov' });
    this.pickups = h('div', { id: 'pickups' });
    this.scope = h('div', { id: 'scope' });
    this.pumpkinOv = h('div', { id: 'pumpkinov' });
    this.bossBar = h('div', { id: 'bossbar' }, this.bossName = h('div', { class: 'bossn' }), h('div', { class: 'bossb' }, this.bossFill = h('div', { class: 'bossf' })));
    hud.append(this.pumpkinOv, this.bossBar, this.scope, this.cross, this.stats, this.xpBar, this.hotbar, this.itemName, this.msgBox, this.dbg, this.fps, this.fireOv, this.sleepOv, this.pickups);
    this.root.appendChild(hud);
    this.screen = h('div', { id: 'screen' });
    this.root.appendChild(this.screen);
    hud.style.display = 'none';
  }
  applyHudVisibility() { this.hud.classList.toggle('hidden', !!SETTINGS.hudHidden); }
  onSlotChange() {
    const p = this.game.player; if (!p) return;
    const s = p.heldStack();
    this.itemName.textContent = s ? itemName(s.id) : '';
    this.itemName.style.opacity = 1; this.itemNameT = 2.5;
    this.renderHotbar();
    this.game.equipT = 0;
  }
  renderHotbar(force) {
    const p = this.game.player; if (!p) return;
    for (let i = 0; i < 9; i++) { if (force) this.hbSlots[i]._key = null; this.renderSlot(this.hbSlots[i], p.inv.get(i), this.hbPx); }
    this.hbSel.style.transform = `translateX(${p.sel * this.hbPx}px)`;
  }
  onPickup(id, n) {
    if (!IS_TOUCH && !this.debug) return;
    const el = h('div', { class: 'pick' }, '+' + n + ' ' + itemName(id));
    this.pickups.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }
  message(text, color) {
    const el = h('div', { class: 'msg' }, text);
    if (color) el.style.color = color;
    this.msgBox.appendChild(el);
    this.msgs.push({ el, t: 10 });
    while (this.msgBox.children.length > 8) this.msgBox.firstChild.remove();
  }
  updateHUD(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    const show = g.state === 'playing' || g.state === 'paused' || g.state === 'dead';
    this.hud.style.display = show ? 'block' : 'none';
    if (!show) return;
    this.hud.classList.toggle('riding', !!p.vehicle); this.hud.classList.toggle('bike', !!(p.vehicle && p.vehicle.kind === 'bike'));
    const surv = !p.creative && !p.spectator;
    this.stats.style.visibility = surv ? 'visible' : 'hidden';
    this.xpBar.style.visibility = surv ? 'visible' : 'hidden';
    if (p.inv.version !== this.invVer || p.sel !== this.lastSel) { this.invVer = p.inv.version; this.lastSel = p.sel; this.renderHotbar(); }
    const setRow = (row, val, full, half, empty, hideEmpty) => {
      const key = val + full; if (row._k === key) return; row._k = key;
      for (let i = 0; i < 10; i++) { const v = val - i * 2; row.items[i].className = 'bi ' + (v >= 2 ? full : v === 1 ? half : empty); row.items[i].style.visibility = hideEmpty && v <= 0 ? 'hidden' : 'visible'; }
    };
    if (surv) {
      const hp = Math.ceil(p.health);
      setRow(this.hearts, hp, 'i-hf', 'i-hh', 'i-he');
      this.hearts.classList.toggle('low', hp <= 4);
      this.hearts.classList.toggle('flash', p.hurtTime > 0);
      setRow(this.foods, p.food, 'i-ff', 'i-fh', 'i-fe');
      this.foods.classList.toggle('shake', p.food <= 4);
      const ar = p.armorPoints(); this.armorRow.style.display = ar > 0 ? 'flex' : 'none'; setRow(this.armorRow, ar, 'i-af', 'i-ah', 'i-ae');
      const air = p.air < 300 ? Math.ceil(p.air / 300 * 20) : -1;
      this.bubbles.style.display = air >= 0 ? 'flex' : 'none'; if (air >= 0) setRow(this.bubbles, air, 'i-bf', 'i-bf', 'i-bf', true);
      this.xpFill.style.width = (p.xp * 100) + '%'; this.xpLvl.textContent = p.xpLevel > 0 ? p.xpLevel : '';
    }
    // compass / clock readouts replace the item name while held
    const held = ITEMS[p.heldId()], info = held && held.info;
    if (info && (g.frame & 7) === 0) {
      let txt;
      if (info === 'clock') {
        if (g.world.dim !== 'overworld') txt = 'Clock: the hands spin aimlessly';
        else { const t = ((g.time % 24000) + 24000) % 24000, hrs = (Math.floor(t / 1000) + 6) % 24, mins = Math.floor((t % 1000) * 0.06); txt = `Day ${Math.floor(g.time / 24000) + 1} · ${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${t > 12500 && t < 23500 ? '(night)' : ''}`; }
      } else {
        const sp = p.spawnPoint && p.spawnPoint.dim === 'overworld' ? [p.spawnPoint.x, p.spawnPoint.z] : g.meta && g.meta.spawn ? [g.meta.spawn[0], g.meta.spawn[2]] : null;
        if (g.world.dim !== 'overworld' || !sp) txt = 'Compass: the needle spins wildly';
        else {
          const dx = sp[0] - p.x, dz = sp[1] - p.z, d = Math.hypot(dx, dz);
          const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], a = (Math.atan2(dx, -dz) / (Math.PI / 4) + 8.5) & 7;
          txt = d < 3 ? 'Compass: you are at spawn' : `Spawn: ${Math.round(d)} blocks ${dirs[a]}`;
        }
      }
      this.itemName.textContent = txt; this.itemName.style.opacity = 1; this.itemNameT = 1;
    }
    this.scope.style.display = p.using === 'spyglass' && p.camMode === 0 ? 'block' : 'none';
    const helm = p.inv.get(36);
    this.pumpkinOv.style.display = helm && helm.id === B.carved_pumpkin && p.camMode === 0 && !p.vehicle ? 'block' : 'none';
    // boss bar while the dragon is near
    const bb = g.endFight && g.endFight.bar();
    this.bossBar.style.display = bb ? 'block' : 'none';
    if (bb) { if (this.bossName.textContent !== bb.name) this.bossName.textContent = bb.name; this.bossFill.style.width = (bb.f * 100).toFixed(1) + '%'; }
    if (this.itemNameT > 0) { this.itemNameT -= dt; if (this.itemNameT < 0.5) this.itemName.style.opacity = Math.max(0, this.itemNameT * 2); }
    for (const m of this.msgs) { m.t -= dt; if (m.t < 1) m.el.style.opacity = Math.max(0, m.t); }
    this.msgs = this.msgs.filter(m => m.t > 0 || this.chatOpen);
    this.fireOv.style.opacity = p.fireTicks > 0 && !p.creative ? 1 : 0;
    this.cross.style.display = p.camMode === 0 && !SETTINGS.hudHidden ? 'block' : 'none';
    // debug / fps
    this.fps.style.display = SETTINGS.showFps && !this.debug ? 'block' : 'none';
    if (SETTINGS.showFps) this.fps.textContent = Math.round(g.fpsSmooth) + ' FPS';
    this.dbg.style.display = this.debug ? 'block' : 'none';
    if (this.debug && (g.frame & 7) === 0) {
      const w = g.world, R = g.renderer, bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
      const l = w.getLight(bx, by, bz), dirs = ['north (-Z)', 'east (+X)', 'south (+Z)', 'west (-X)'];
      const t = p.target;
      this.dbg.textContent = [
        `VoxelCraft  ${Math.round(g.fpsSmooth)} fps  (${(g.frameMs || 0).toFixed(1)} ms)`,
        `Renderer: ${GLX.renderer}  ${R.width}x${R.height}${R.hdr ? ' HDR' : ''}`,
        `Draws: ${R.stats.draws}  Tris: ${(R.stats.tris / 1000).toFixed(0)}k  Sections: ${R.stats.sections}`,
        R.debugInfo(),
        `Chunks: ${w.chunks.size} loaded, ${w.pending.size} pending, ${w.meshQueue.size} mesh queue, light queue ${w.lightQueue.length}`,
        `Entities: ${w.entities.length}  Particles: ${g.particles.list.length}`,
        `XYZ: ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
        `Block: ${bx} ${by} ${bz}  Chunk: ${bx >> 4} ${bz >> 4} [${bx & 15} ${by} ${bz & 15}]`,
        `Facing: ${dirs[p.facing()]}  (${(p.yaw / DEG % 360).toFixed(1)} / ${(p.pitch / DEG).toFixed(1)})`,
        `Biome: ${BIOMES[w.biomeAt(bx, bz)].name}  Dimension: ${w.dim}`,
        `Light: ${Math.max(l >> 4, l & 15)} (sky ${l >> 4}, block ${l & 15})`,
        `Day ${Math.floor(g.time / 24000)}, time ${Math.floor(g.time % 24000)}  Rain ${(g.rainLevel * 100 | 0)}%`,
        t && !t.entity ? `Looking at: ${blockName(t.id)} [${t.v >> 12}] @ ${t.x} ${t.y} ${t.z}` : t && t.entity ? `Looking at: ${t.entity.type} (${Math.ceil(t.entity.health)} hp)` : '',
      ].join('\n');
    }
  }
  showSleep(v) { this.sleepOv.style.opacity = v; }
  hideSleep() { this.sleepOv.style.opacity = 0; }
  // ------------------------------------------------------------------ generic menu helpers
  clearScreen() { this.screen.innerHTML = ''; this.screen.className = ''; this.hideTip(); }
  btn(label, fn, cls) { const b = h('button', { class: 'mbtn ' + (cls || '') }, label); b.addEventListener('click', (e) => { e.preventDefault(); this.game.audio.init(); this.game.audio.play('click', {}); fn(); }); return b; }
  panel(title, ...kids) { return h('div', { class: 'panel' }, title ? h('h2', null, title) : null, ...kids); }
  back() { if (this.backFn) this.backFn(); }
  logo() {
    const word = 'VOXELCRAFT', px = 6, gap = 1;
    const c = document.createElement('canvas');
    const W = word.length * (5 * px + gap * px) + px * 2, H = 7 * px + px * 3;
    c.width = W; c.height = H; c.className = 'logo';
    const g = c.getContext('2d');
    const stone = paintTex('cobblestone'), grass = paintTex('grass_top');
    for (let pass = 0; pass < 2; pass++) {
      let ox = px;
      for (const ch of word) {
        const f = FONT5[ch];
        for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (f[y][x] === '#') {
          const X = ox + x * px, Y = y * px + px;
          if (pass === 0) { g.fillStyle = '#1b1b1b'; g.fillRect(X + px * 0.5, Y + px * 0.6, px, px); }
          else {
            for (let yy = 0; yy < px; yy++) for (let xx = 0; xx < px; xx++) {
              const tx = (X + xx) & 15, ty = (Y + yy) & 15;
              let cc = y === 0 || f[y - 1][x] !== '#' ? (yy < px * 0.35 ? grass.get(tx, ty) : stone.get(tx, ty)) : stone.get(tx, ty);
              if (y === 0 || f[y - 1][x] !== '#') { if (yy < px * 0.35) cc = csh(mixColor(cc, 0x5aa83a, 0.75), 1.0); }
              const r = (cc >> 16) & 255, gg = (cc >> 8) & 255, b = cc & 255;
              g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(X + xx, Y + yy, 1, 1);
            }
          }
        }
        ox += 5 * px + gap * px;
      }
    }
    return c;
  }
  // ------------------------------------------------------------------ title & world screens
  showTitle() {
    this.hud.style.display = 'none';
    const g = this.game;
    this.clearScreen(); this.screen.className = 'menu title';
    this.backFn = null;
    const splash = h('div', { class: 'splash' }, SPLASHES[randInt(0, SPLASHES.length - 1)]);
    this.screen.append(h('div', { class: 'logo-wrap' }, this.logo(), splash),
      h('div', { class: 'menu-buttons' },
        this.btn('Singleplayer', () => this.showWorlds()),
        this.btn('Settings', () => this.showSettings(() => this.showTitle())),
        this.btn('Controls & Help', () => this.showControls(() => this.showTitle()))),
      h('div', { class: 'foot' }, h('span', null, 'VoxelCraft 1.0 — all art, sound & worlds are procedurally generated'), h('span', null, GLX.renderer || '')));
    if (GLX.software) this.screen.appendChild(h('div', { class: 'swwarn' }, 'Your browser is drawing this game without the graphics card (software rendering), so it will be slow. Turn on "Use graphics acceleration when available" in the browser settings and restart the browser.'));
  }
  async showWorlds() {
    const g = this.game;
    this.clearScreen(); this.screen.className = 'menu';
    this.backFn = () => this.showTitle();
    const worlds = await g.save.listWorlds();
    let sel = worlds[0] ? worlds[0].id : null;
    const list = h('div', { class: 'wlist' });
    const draw = () => {
      list.innerHTML = '';
      if (!worlds.length) list.append(h('div', { class: 'empty' }, 'No worlds yet — create one!'));
      for (const w of worlds) {
        const it = h('div', { class: 'witem' + (w.id === sel ? ' sel' : '') },
          h('div', { class: 'wname' }, w.name), h('div', { class: 'wsub' }, `${titleCase(w.mode)} · ${['Peaceful', 'Easy', 'Normal', 'Hard'][w.difficulty]} · ${fmtTime(w.lastPlayed || w.created)}`), h('div', { class: 'wsub' }, `Seed: ${w.seed}` + (w.type !== 'default' ? ' · ' + titleCase(w.type) : '')));
        it.addEventListener('click', () => { sel = w.id; draw(); });
        it.addEventListener('dblclick', () => g.playWorld(w));
        list.appendChild(it);
      }
    };
    draw();
    this.screen.append(this.panel('Select World', list,
      h('div', { class: 'row' },
        this.btn('Play Selected', () => { const w = worlds.find(x => x.id === sel); if (w) g.playWorld(w); }, 'primary'),
        this.btn('Create New World', () => this.showCreate())),
      h('div', { class: 'row' },
        this.btn('Delete', async () => { const w = worlds.find(x => x.id === sel); if (!w) return; if (!confirm(`Delete "${w.name}" forever?`)) return; await g.save.deleteWorld(w.id); this.showWorlds(); }, 'danger'),
        this.btn('Back', () => this.showTitle()))));
  }
  showCreate() {
    const g = this.game;
    this.clearScreen(); this.screen.className = 'menu';
    this.backFn = () => this.showWorlds();
    const name = h('input', { type: 'text', value: 'New World', maxlength: 32 });
    const seed = h('input', { type: 'text', placeholder: 'Leave blank for random' });
    const opt = (vals, cur) => { const s = h('select'); for (const [v, l] of vals) s.appendChild(h('option', { value: v, selected: v === cur }, l)); return s; };
    const mode = opt([['survival', 'Survival'], ['creative', 'Creative']], 'survival');
    const diff = opt([['0', 'Peaceful'], ['1', 'Easy'], ['2', 'Normal'], ['3', 'Hard']], '2');
    const type = opt([['default', 'Default'], ['amplified', 'Amplified'], ['flat', 'Superflat']], 'default');
    const structs = h('input', { type: 'checkbox', checked: true });
    const cheats = h('input', { type: 'checkbox', checked: true });
    const bonus = h('input', { type: 'checkbox' });
    const field = (l, el) => h('label', { class: 'field' }, h('span', null, l), el);
    this.screen.append(this.panel('Create New World',
      field('World Name', name), field('Seed', seed), field('Game Mode', mode), field('Difficulty', diff), field('World Type', type),
      field('Generate Structures', structs), field('Allow Commands', cheats), field('Bonus Chest', bonus),
      h('div', { class: 'row' },
        this.btn('Create World', () => {
          const s = seedFromString(seed.value);
          g.createWorld({ name: name.value.trim() || 'New World', seed: s, seedText: seed.value || String(s), mode: mode.value, difficulty: +diff.value, type: type.value, structures: structs.checked, cheats: cheats.checked, bonus: bonus.checked });
        }, 'primary'),
        this.btn('Cancel', () => this.showWorlds()))));
    setTimeout(() => name.select(), 50);
  }
  showLoading(text, frac) {
    if (!this.loadingEl) {
      this.clearScreen(); this.screen.className = 'menu loading';
      this.loadingEl = h('div', { class: 'loadbox' }, this.loadText = h('div', { class: 'ltext' }), h('div', { class: 'lbar' }, this.loadFill = h('div', { class: 'lfill' })), this.loadTip = h('div', { class: 'ltip' }, ['Tip: Hold on a block to mine it (touch).', 'Tip: Press E to open your inventory.', 'Tip: Craft a crafting table from 4 planks.', 'Tip: Obsidian frames + fire open the nether.', 'Tip: Boomcaps hiss before they pop!', 'Tip: Torches keep monsters away.', 'Tip: Villagers trade emeralds.', 'Tip: Graphics presets are in Settings.', 'Tip: Throw an eye of ender and follow it to a stronghold.', 'Tip: Destroy the end crystals first — they heal the dragon.', 'Tip: Never look an enderman in the eye (unless you wear a pumpkin).', 'Tip: An elytra and a few fireworks turn a jump into a flight.'][randInt(0, 11)]));
      this.screen.appendChild(this.loadingEl);
    }
    this.loadText.textContent = text;
    this.loadFill.style.width = Math.round(clamp(frac, 0, 1) * 100) + '%';
  }
  hideLoading() { this.loadingEl = null; this.clearScreen(); }
  showPause() {
    const g = this.game;
    this.clearScreen(); this.screen.className = 'menu pause';
    this.backFn = () => g.resume();
    this.screen.append(this.panel('Game Menu',
      this.btn('Back to Game', () => g.resume(), 'primary'),
      this.btn('Settings', () => this.showSettings(() => this.showPause())),
      this.btn('Controls & Help', () => this.showControls(() => this.showPause())),
      g.meta && g.meta.cheats ? this.btn('Teleport', () => { this.clearScreen(); g.state = 'playing'; g.input.updateTouchVisibility(); this.chatWith('/tp '); }) : null,
      g.meta && g.meta.cheats ? this.btn('Commands: ' + (g.player.creative ? 'Survival' : 'Creative') + ' Mode', () => { g.runCommand('/gamemode ' + (g.player.creative ? 'survival' : 'creative')); this.showPause(); }) : null,
      this.btn('Save & Quit to Title', () => g.quitToTitle(), 'danger')));
  }
  showDeath(msg) {
    const g = this.game;
    this.clearScreen(); this.screen.className = 'menu death';
    this.backFn = null;
    this.screen.append(h('div', { class: 'deathbox' }, h('h1', null, 'You Died!'), h('div', { class: 'dmsg' }, msg || ''), h('div', { class: 'dmsg' }, 'Score: ' + (g.player.xpLevel * 7 + g.player.stats.kills)),
      this.btn('Respawn', () => g.respawn(), 'primary'), this.btn('Title Screen', () => g.quitToTitle())));
  }
  // shown once, the first time you step through the exit portal after the dragon falls
  showCredits(done) {
    const g = this.game;
    let fin = false;
    const finish = () => { if (fin) return; fin = true; clearTimeout(this.credT); this.clearScreen(); g.state = 'playing'; g.input.requestLock(); g.input.updateTouchVisibility(); if (done) done(); };
    g.state = 'paused'; g.input.releaseLock(); this.clearScreen(); this.screen.className = 'menu credits';
    this.backFn = finish;
    const lines = [
      ['h', 'THE END'], ['', ''],
      ['', 'You crossed the void, and the void let you go.'],
      ['', 'Somewhere below, a world of small square things is waiting for you.'],
      ['', 'Every block you placed there was a choice, and every choice was yours.'], ['', ''],
      ['', 'The dragon is gone. The islands are quiet.'],
      ['', 'The eyes that watched you from the frames have closed.'], ['', ''],
      ['', 'Past the gateway lie a thousand more islands,'],
      ['', 'cities of purpur, and ships that sail on nothing at all.'],
      ['', 'Go and see them, or go home. Both are good answers.'], ['', ''],
      ['', 'The world will still be there when you wake.'], ['', ''], ['', ''],
      ['h', 'VOXELCRAFT'], ['', ''],
      ['s', 'Worlds'], ['', 'Procedural terrain, caves, villages, strongholds and islands in the sky'],
      ['s', 'Art & Sound'], ['', 'Every texture painted and every sound synthesized when the game loads'],
      ['s', 'Engine'], ['', 'WebGL 2 · Web Workers · Web Audio'], ['', ''], ['', ''],
      ['h', 'Thank you for playing'],
    ];
    const roll = h('div', { class: 'croll' }, ...lines.map(([k, t]) => h(k === 'h' ? 'h2' : k === 's' ? 'h4' : 'p', null, t || '\u00a0')));
    this.screen.append(h('div', { class: 'cview' }, roll), this.btn('Skip', finish));
    const dur = 60;
    roll.style.animationDuration = dur + 's';
    this.credT = setTimeout(finish, dur * 1000 + 1500);
  }
  showControls(back) {
    this.clearScreen(); this.screen.className = 'menu';
    this.backFn = back;
    const rows = [['Move', 'W A S D'], ['Jump / Swim up / Fly up', 'Space (double-tap to fly in Creative)'], ['Sneak / Fly down', 'Shift'], ['Sprint', 'Ctrl or double-tap W'], ['Mine / Attack', 'Left mouse (hold)'], ['Place / Use / Eat', 'Right mouse'], ['Pick block', 'Middle mouse'], ['Hotbar', '1–9 or mouse wheel'], ['Inventory', 'E'], ['Drop item', 'Q (Ctrl+Q whole stack)'], ['Chat / Commands', 'T or /'], ['Perspective', 'F5'], ['Debug info', 'F3'], ['Hide HUD', 'F1'], ['Screenshot', 'F2'], ['Pause', 'Esc']];
    const touch = [['Move', 'Left joystick (push fully forward to sprint)'], ['Look', 'Drag on the right side'], ['Place / Use / Attack', 'Tap on a block or mob'], ['Mine', 'Hold your finger on a block'], ['Jump', '⬆ button (double-tap to fly in Creative)'], ['Sneak', '⇩ toggle'], ['Inventory', '⋯ button'], ['Drop', 'Long-press the selected hotbar slot']];
    const tbl = (r) => h('table', { class: 'ctl' }, ...r.map(([a, b]) => h('tr', null, h('td', null, a), h('td', null, b))));
    const cmds = h('div', { class: 'cmds' }, 'Commands: /help, /vehicle <jet|bomber|gunship|bike|tank|mech|sub|drill>, /gamemode <survival|creative|spectator>, /time set <day|night|noon|midnight|n>, /weather <clear|rain|thunder>, /tp x y z, /give <item> [n], /summon <mob>, /locate <village|pyramid|jungle_temple|igloo|witch_hut|ruined_portal|mineshaft|fortress|stronghold|end_city>, /dimension <overworld|nether|end>, /seed, /kill, /difficulty <0-3>, /spawnpoint, /gamerule <keepInventory|mobGriefing|doDaylightCycle|fireSpread> <true|false>, /clear, /xp <n>, /heal, /feed');
    this.screen.append(this.panel('Controls & Help', h('div', { class: 'scroll' }, h('h3', null, 'Keyboard & Mouse'), tbl(rows), h('h3', null, 'Vehicles'), tbl([['Board / exit', 'F next to a vehicle (or right-click it)'], ['Camera', 'F5 cycles chase, cockpit and far chase; mouse wheel zooms'], ['Stormcrow jet', 'Mouse steers, W/S throttle, Ctrl afterburner, A/D roll, Shift airbrake, LMB plasma cannons, RMB Hydra missile (hold the nose on a target to lock)'], ['Mantis VTOL', 'Mouse aims, WASD move, Space/Shift climb and descend, Ctrl boost, LMB cutting laser (burns through blocks), RMB rocket salvo'], ['Viper hover bike', 'Mouse steers, W/S throttle, A/D strafe, Space hop, Ctrl boost, LMB twin blasters, RMB hold to charge a fusion shot'], ['Wraith bomber', 'Flies like the jet; hold RMB to open the bay and drop plasma bombs on the yellow CCIP ring'], ['Jet cockpits', 'F5 to the cockpit and the Stormcrow and Wraith fly like a simulator: the mouse pitches and rolls the airframe directly and nothing levels it for you, so loops, rolls and inverted flight all work. A/D is the rudder, hold C or the middle mouse button to look around, the wheel zooms. The flight computer holds your flight path when you let go, even upside down. The chase cameras keep the assisted mouse aim. Pull hard for too long and the view greys out'], ['Bastion hover tank', 'Mouse aims the turret, W/S drive, A/D turn the hull, Ctrl boost, LMB coax blaster, RMB arcing plasma cannon (the ring shows where the shell lands)'], ['Titan mech', 'WASD walks toward where you aim (the legs turn by themselves), mouse twists the torso, Ctrl runs, Space fires the jump jets (landing hard pounds the ground), LMB twin autocannons, RMB eight-rocket salvo'], ['Nautilus submarine', 'Underwater the mouse steers and dives, W/S propeller, Space/Shift ballast, Ctrl boost, LMB pulse laser, RMB torpedo. Headlights light up the deep; on the surface it floats'], ['Mole tunnel borer', 'W/S drive, A/D turn, hold LMB to spin the drill and bore a 3x3 tunnel; look up or down to bore at an angle. Ores go straight into your inventory. Ctrl overdrive, RMB seismic charge'], ['Get one', 'Creative inventory Vehicles tab, /vehicle jet|bomber|gunship|bike|tank|mech|sub|drill, or craft with iron, diamonds, redstone, glass and gunpowder']]), h('h3', null, 'The End'), tbl([['Find it', 'Craft eyes of ender (ember powder + ender pearl) and throw them; they fly toward the nearest stronghold'], ['Open the portal', 'Put an eye in each of the 12 frames in the stronghold\'s portal room'], ['The fight', 'Destroy the end crystals on the obsidian pillars (they heal the dragon), then hit its head — it takes the most damage there. Arrows and vehicle weapons work too'], ['Going home', 'When the dragon falls the exit portal lights up; an end gateway opens to the outer islands'], ['Endermen', 'They attack if you look them in the eye; a carved pumpkin worn as a helmet keeps you safe. They hate water'], ['Elytra', 'Found on end ships. Wear it in the chest slot, jump, then press jump again in mid-air to glide; use fireworks to boost']]), h('h3', null, 'Touch'), tbl(touch), h('h3', null, 'Gamepad'), h('p', null, 'Left stick move · Right stick look · A jump · B sneak · RT mine/attack · LT use/place · LB/RB hotbar · Y inventory · Start pause · L3 sprint'), cmds), this.btn('Done', back, 'primary')));
  }
  // ------------------------------------------------------------------ settings
  showSettings(back) {
    const g = this.game;
    this.clearScreen(); this.screen.className = 'menu';
    this.backFn = back;
    const S = SETTINGS;
    const pct = (v) => Math.round(v * 100) + '%';
    const schema = {
      Video: [
        { k: 'preset', type: 'preset' },
        { k: 'autoQuality', l: 'Auto Quality (keeps FPS smooth)', type: 'bool' },
        { k: 'renderDist', l: 'Render Distance', type: 'range', min: 2, max: 24, step: 1, f: v => v + ' chunks' },
        { k: 'resScale', l: 'Resolution Scale', type: 'range', min: 0.3, max: 1, step: 0.05, f: pct },
        { k: 'maxDPR', l: 'Max Pixel Density', type: 'range', min: 0.5, max: 3, step: 0.25, f: v => v + 'x' },
        { k: 'sharpen', l: 'Sharpening', type: 'range', min: 0, max: 1, step: 0.05, f: v => v === 0 ? 'Off' : pct(v) },
        { k: 'shadows', l: 'Shadows', type: 'select', o: ['Off', 'Low', 'High', 'Ultra (soft)'] },
        { k: 'water', l: 'Water', type: 'select', o: ['Simple', 'Fancy', 'Shader (refraction + SSR)', 'Ultra (long-range SSR)'] },
        { k: 'clouds', l: 'Clouds', type: 'select', o: ['Off', 'Fast', 'Fancy', 'Volumetric (shader)'] },
        { k: 'fancyLeaves', l: 'Fancy Leaves', type: 'bool' },
        { k: 'smoothLight', l: 'Smooth Lighting', type: 'bool' },
        { k: 'waving', l: 'Waving Plants & Water', type: 'bool' },
        { k: 'bloom', l: 'Bloom', type: 'bool' },
        { k: 'godrays', l: 'God Rays', type: 'bool' },
        { k: 'fxaa', l: 'Edge Anti-Aliasing', type: 'bool' },
        { k: 'tonemap', l: 'Cinematic Tonemapping', type: 'bool' },
        { k: 'vignette', l: 'Vignette', type: 'bool' },
        { k: 'fog', l: 'Distance Fog', type: 'bool' },
        { k: 'particles', l: 'Particles', type: 'select', o: ['Minimal', 'Decreased', 'All'] },
        { k: 'entityDist', l: 'Entity Distance', type: 'range', min: 16, max: 128, step: 8, f: v => v + ' blocks' },
        { k: 'fov', l: 'Field of View', type: 'range', min: 50, max: 110, step: 1, f: v => v + '°' },
        { k: 'brightness', l: 'Brightness', type: 'range', min: 0, max: 1, step: 0.05, f: v => v === 0 ? 'Moody' : v === 1 ? 'Bright' : pct(v) },
        { k: 'viewBob', l: 'View Bobbing', type: 'bool' },
        { k: 'fpsCap', l: 'Max FPS', type: 'select', o: ['Unlimited', '30', '60', '90', '120'], v: [0, 30, 60, 90, 120] },
        { k: 'guiScale', l: 'GUI Scale', type: 'select', o: ['Auto', 'Small', 'Normal', 'Large'], v: [0, 0.8, 1, 1.2] },
        { k: 'showFps', l: 'Show FPS', type: 'bool' },
      ],
      Controls: [
        { k: 'sensitivity', l: 'Look Sensitivity', type: 'range', min: 0, max: 1, step: 0.02, f: pct },
        { k: 'invertY', l: 'Invert Y', type: 'bool' },
        { k: 'flightInvert', l: 'Jet Cockpit: Pull Back For Nose Up', type: 'bool' },
        { k: 'cockpitFx', l: 'Jet Cockpit: G-Forces & Buffeting', type: 'bool' },
        { k: 'autoJump', l: 'Auto-Jump', type: 'bool' },
        { k: 'buttonSize', l: 'Touch Button Size', type: 'range', min: 0.6, max: 1.6, step: 0.05, f: pct },
        { k: 'buttonOpacity', l: 'Touch Button Opacity', type: 'range', min: 0.15, max: 1, step: 0.05, f: pct },
      ],
      Audio: [
        { k: 'masterVol', l: 'Master Volume', type: 'range', min: 0, max: 1, step: 0.05, f: pct },
        { k: 'musicVol', l: 'Music', type: 'range', min: 0, max: 1, step: 0.05, f: pct },
        { k: 'sfxVol', l: 'Sounds', type: 'range', min: 0, max: 1, step: 0.05, f: pct },
        { k: 'ambientVol', l: 'Ambience & Weather', type: 'range', min: 0, max: 1, step: 0.05, f: pct },
      ],
    };
    const body = h('div', { class: 'scroll settings' });
    const tabs = h('div', { class: 'tabs' });
    let tab = this.settingsTab || 'Video';
    const apply = (k) => {
      saveSettings();
      if (['shadows', 'water', 'bloom', 'godrays', 'fxaa', 'tonemap', 'resScale', 'maxDPR', 'preset', 'sharpen', 'autoQuality', 'clouds'].includes(k)) { g.renderer.freePost(); g.renderer.post = null; g.renderer.width = 0; g.renderer.resize(); }
      if (['fancyLeaves', 'smoothLight', 'preset'].includes(k) && g.world) g.world.remeshAll();
      if (['masterVol', 'musicVol', 'sfxVol', 'ambientVol'].includes(k)) g.audio.applyVolumes();
      if (['buttonSize', 'buttonOpacity'].includes(k)) g.input.applyTouchLayout();
      if (k === 'guiScale') this.layout();
      if (k === 'renderDist' || k === 'preset') g.renderer.visDirty = true;
      if (k !== 'preset' && schema.Video.some(x => x.k === k)) { SETTINGS.preset = 'custom'; }
    };
    const draw = () => {
      body.innerHTML = ''; tabs.innerHTML = '';
      for (const t of Object.keys(schema)) { const b = h('button', { class: 'tab' + (t === tab ? ' on' : '') }, t); b.onclick = () => { tab = this.settingsTab = t; draw(); }; tabs.appendChild(b); }
      for (const it of schema[tab]) {
        if (it.type === 'preset') {
          const row = h('div', { class: 'presets' }, h('span', null, 'Preset:'));
          for (const p of ['potato', 'low', 'medium', 'high', 'ultra']) { const b = h('button', { class: 'pbtn' + (S.preset === p ? ' on' : '') }, titleCase(p)); b.onclick = () => { applyPreset(p); apply('preset'); draw(); }; row.appendChild(b); }
          body.appendChild(row); continue;
        }
        let ctl;
        const val = h('span', { class: 'val' });
        if (it.type === 'range') {
          ctl = h('input', { type: 'range', min: it.min, max: it.max, step: it.step, value: S[it.k] });
          val.textContent = it.f(S[it.k]);
          ctl.oninput = () => { S[it.k] = +ctl.value; val.textContent = it.f(S[it.k]); };
          ctl.onchange = () => apply(it.k);
        } else if (it.type === 'bool') {
          ctl = h('button', { class: 'toggle' + (S[it.k] ? ' on' : '') }, S[it.k] ? 'ON' : 'OFF');
          ctl.onclick = () => { S[it.k] = !S[it.k]; ctl.className = 'toggle' + (S[it.k] ? ' on' : ''); ctl.textContent = S[it.k] ? 'ON' : 'OFF'; apply(it.k); };
        } else {
          ctl = h('select');
          it.o.forEach((o, i) => ctl.appendChild(h('option', { value: i, selected: (it.v ? it.v[i] : i) === S[it.k] }, o)));
          ctl.onchange = () => { S[it.k] = it.v ? it.v[+ctl.value] : +ctl.value; apply(it.k); };
        }
        body.appendChild(h('div', { class: 'srow' }, h('span', { class: 'lbl' }, it.l), ctl, val));
      }
    };
    draw();
    this.screen.append(this.panel('Settings', tabs, body, this.btn('Done', back, 'primary')));
  }
  // ------------------------------------------------------------------ chat
  openChat(prefix) {
    if (this.chatOpen) return;
    const g = this.game;
    this.chatOpen = true;
    g.input.releaseLock();
    const inp = h('input', { id: 'chatin', type: 'text', value: prefix || '', autocomplete: 'off' });
    this.chatEl = h('div', { id: 'chat' }, inp);
    this.hud.appendChild(this.chatEl);
    for (const m of this.msgs) { m.t = Math.max(m.t, 5); m.el.style.opacity = 1; }
    setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 30);
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { const v = inp.value.trim(); this.closeChat(); if (v) { if (v.startsWith('/')) g.runCommand(v); else this.message('<Player> ' + v); } }
      else if (e.key === 'Escape') this.closeChat();
    });
  }
  // clickable coordinates: fills the chat with a surface /tp so Enter takes you there
  tpLink(x, z) {
    const cmd = `/tp ${x} ${z}`;
    const go = (e) => { e.preventDefault(); e.stopPropagation(); this.chatWith(cmd); };
    const el = h('span', { class: 'tplink', title: cmd }, `${x}, ~, ${z}`);
    el.addEventListener('mousedown', go); el.addEventListener('touchstart', go, { passive: false });
    return el;
  }
  chatWith(text) {
    if (!this.chatOpen) { this.openChat(text); return; }
    const inp = this.chatEl && this.chatEl.querySelector('input'); if (!inp) return;
    inp.value = text; setTimeout(() => { inp.focus(); inp.setSelectionRange(text.length, text.length); }, 0);
  }
  closeChat() { if (!this.chatOpen) return; this.chatOpen = false; if (this.chatEl) this.chatEl.remove(); this.chatEl = null; if (this.game.state === 'playing' && !this.open) this.game.input.requestLock(); }
  // ------------------------------------------------------------------ container screens
  moveCursor() {
    const el = this.cursorEl;
    if (!this.cursor || !this.open) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    this.renderSlot(el, this.cursor, this.slotPx);
    el.style.left = (this.mx - this.slotPx / 2) + 'px'; el.style.top = (this.my - this.slotPx / 2) + 'px';
  }
  showTip(text, x, y) { const t = this.tipEl; t.textContent = text; t.style.display = 'block'; t.style.left = Math.min(window.innerWidth - 200, x + 14) + 'px'; t.style.top = Math.max(0, y - 30) + 'px'; }
  hideTip() { if (this.tipEl) this.tipEl.style.display = 'none'; }
  itemTip(st) { if (!st) return ''; const d = ITEMS[st.id]; let t = itemName(st.id); if (d && d.dur) t += `  (${d.dur - (st.d || 0)}/${d.dur})`; if (d && d.armor) t += `  +${d.armor.def} armor`; if (d && d.tool && d.tool.dmg > 1) t += `  ${d.tool.dmg} dmg`; if (d && d.food) t += `  +${d.food[0]} food`; return t; }
  makeSlot(ref) {
    const el = h('div', { class: 'slot' + (ref.cls ? ' ' + ref.cls : '') });
    el._ref = ref;
    if (ref.kind === 'output') el._out = true;
    ref.el = el;
    let pressT = 0, lpTimer = null, lastTap = 0;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      this.game.audio.init();
      if (e.pointerType === 'mouse') {
        if (this.cursor && (e.button === 0 || e.button === 2) && !e.shiftKey && ref.kind !== 'output' && ref.kind !== 'creative') { this.drag = { btn: e.button, slots: [ref], start: ref }; }
        else this.slotClick(ref, e.button === 2 ? 1 : 0, e.shiftKey);
      } else {
        pressT = now();
        lpTimer = setTimeout(() => { lpTimer = null; this.slotClick(ref, 1, false); if (navigator.vibrate) navigator.vibrate(15); }, 420);
      }
    });
    el.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse') return;
      if (lpTimer) {
        clearTimeout(lpTimer); lpTimer = null;
        const t = now();
        if (t - lastTap < 300 && ref.kind !== 'output') { this.slotClick(ref, 0, true); lastTap = 0; }
        else { this.slotClick(ref, 0, false); lastTap = t; }
        const st = ref.get(); if (st) this.showTip(this.itemTip(st), e.clientX, e.clientY - 20); setTimeout(() => this.hideTip(), 1200);
        this.mx = e.clientX; this.my = e.clientY; this.moveCursor();
      }
    });
    el.addEventListener('pointerenter', (e) => {
      if (this.drag && e.pointerType === 'mouse' && e.buttons && !this.drag.slots.includes(ref) && ref.kind !== 'output' && ref.kind !== 'creative') { this.drag.slots.push(ref); el.classList.add('dragsel'); }
      const st = ref.get(); if (st && e.pointerType === 'mouse') this.showTip(this.itemTip(st), e.clientX, e.clientY);
    });
    el.addEventListener('pointerleave', () => this.hideTip());
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    return el;
  }
  endDrag() {
    const d = this.drag; this.drag = null;
    if (!d) return;
    for (const r of d.slots) r.el.classList.remove('dragsel');
    if (d.slots.length <= 1 || !this.cursor) { this.slotClick(d.start, d.btn === 2 ? 1 : 0, false); return; }
    const valid = d.slots.filter(r => { const s = r.get(); return (!s || (s.id === this.cursor.id && !s.d)) && this.accepts(r, this.cursor); });
    if (!valid.length) return;
    const total = this.cursor.n, ms = maxStack(this.cursor.id);
    const per = d.btn === 2 ? 1 : Math.max(1, Math.floor(total / valid.length));
    let left = total;
    for (const r of valid) {
      if (left <= 0) break;
      const s = r.get(); const cur = s ? s.n : 0; const put = Math.min(per, ms - cur, left);
      if (put <= 0) continue;
      r.set({ id: this.cursor.id, n: cur + put, d: this.cursor.d || 0 }); left -= put;
    }
    this.cursor = left > 0 ? { id: this.cursor.id, n: left, d: this.cursor.d } : null;
    this.refresh();
  }
  accepts(ref, stack) {
    if (!stack) return true;
    if (ref.kind === 'output' || ref.kind === 'furnaceOut') return false;
    if (ref.kind === 'armor') { const a = ITEMS[stack.id].armor; return !!(a && a.slot === ref.slot); }
    if (ref.kind === 'fuel') return fuelValue(stack.id) > 0;
    return true;
  }
  slotClick(ref, btn, shift) {
    const g = this.game;
    if (ref.kind === 'creative') { this.creativeClick(ref, btn, shift); this.refresh(); return; }
    if (ref.kind === 'trash') { this.cursor = null; this.refresh(); return; }
    if (ref.kind === 'output') { this.takeOutput(ref, shift); this.refresh(); return; }
    const st = ref.get();
    if (shift) { if (st) this.quickMove(ref); this.refresh(); return; }
    const cur = this.cursor;
    if (ref.kind === 'furnaceOut') { if (st && (!cur || (cur.id === st.id && cur.n + st.n <= maxStack(st.id)))) { this.cursor = cur ? { id: cur.id, n: cur.n + st.n, d: 0 } : st; ref.set(null); if (ref.onTake) ref.onTake(st); } this.refresh(); return; }
    if (btn === 0) {
      if (!cur) { if (st) { this.cursor = st; ref.set(null); } }
      else if (!st) { if (this.accepts(ref, cur)) { const ms = ref.kind === 'armor' ? 1 : maxStack(cur.id); if (cur.n > ms) { ref.set({ id: cur.id, n: ms, d: cur.d }); cur.n -= ms; } else { ref.set(cur); this.cursor = null; } } }
      else if (st.id === cur.id && !st.d && !cur.d && maxStack(st.id) > 1) { const mv = Math.min(maxStack(st.id) - st.n, cur.n); st.n += mv; cur.n -= mv; ref.set(st); if (cur.n <= 0) this.cursor = null; }
      else if (this.accepts(ref, cur)) { ref.set(cur); this.cursor = st; }
    } else {
      if (!cur) { if (st) { const half = Math.ceil(st.n / 2); this.cursor = { id: st.id, n: half, d: st.d }; st.n -= half; ref.set(st.n > 0 ? st : null); } }
      else if (this.accepts(ref, cur) && (!st || (st.id === cur.id && st.n < maxStack(st.id) && !st.d))) { ref.set({ id: cur.id, n: (st ? st.n : 0) + 1, d: cur.d }); cur.n--; if (cur.n <= 0) this.cursor = null; }
    }
    g.audio.play('click', { vol: 0.3 });
    this.refresh();
  }
  quickMove(ref) {
    const g = this.game, p = g.player, st = ref.get(); if (!st) return;
    const scr = this.scr;
    let targets;
    if (ref.group === 'player') {
      if (scr.containerSlots && scr.containerSlots.length) {
        if (scr.type === 'furnace') { const fuel = fuelValue(st.id) > 0 && !SMELT[st.id]; targets = [fuel ? scr.containerSlots[1] : scr.containerSlots[0]]; }
        else targets = scr.containerSlots;
      } else {
        const a = ITEMS[st.id].armor;
        if (a && !p.inv.get(36 + a.slot)) { p.inv.set(36 + a.slot, st); ref.set(null); return; }
        const idx = ref.idx < 9 ? [...Array(27).keys()].map(i => i + 9) : [...Array(9).keys()];
        targets = idx.map(i => scr.playerSlots.find(r => r.idx === i)).filter(Boolean);
      }
    } else targets = scr.playerSlots.filter(r => r.idx < 36).sort((a, b) => (b.idx < 9) - (a.idx < 9) || b.idx - a.idx);
    let left = st.n;
    const ms = maxStack(st.id);
    for (const pass of [0, 1]) for (const r of targets) {
      if (left <= 0) break;
      if (!this.accepts(r, st)) continue;
      const s = r.get();
      if (pass === 0 && s && s.id === st.id && !s.d && !st.d && s.n < ms) { const mv = Math.min(ms - s.n, left); s.n += mv; left -= mv; r.set(s); }
      if (pass === 1 && !s) { const mv = Math.min(ms, left); r.set({ id: st.id, n: mv, d: st.d }); left -= mv; }
    }
    if (left > 0) { st.n = left; ref.set(st); } else ref.set(null);
    if (ref.onTake && left < st.n) ref.onTake(st);
  }
  takeOutput(ref, shift) {
    const g = this.game, p = g.player;
    const scr = this.scr, grid = scr.grid;
    const craftOnce = () => {
      const r = craftMatch(grid.items.map(s => s ? s.id : 0), grid.size);
      if (!r) return null;
      for (let i = 0; i < grid.items.length; i++) {
        const s = grid.items[i]; if (!s) continue;
        const rem = CRAFT_REMAINS[ITEMS[s.id].name];
        s.n--;
        if (s.n <= 0) grid.items[i] = rem ? { id: I[rem], n: 1, d: 0 } : null;
        else if (rem) { const l = p.inv.add({ id: I[rem], n: 1, d: 0 }); if (l) g.dropStack({ id: I[rem], n: l, d: 0 }); }
      }
      return { id: r.out, n: r.n, d: 0 };
    };
    if (shift) {
      for (let k = 0; k < 64; k++) {
        const r = craftMatch(grid.items.map(s => s ? s.id : 0), grid.size); if (!r) break;
        const res = { id: r.out, n: r.n, d: 0 };
        const tmp = new Inventory(41); tmp.slots = p.inv.slots.map(s => s ? { ...s } : null);
        if (tmp.add(res)) break;
        craftOnce(); p.inv.add(res);
      }
    } else {
      const r = craftMatch(grid.items.map(s => s ? s.id : 0), grid.size); if (!r) return;
      const cur = this.cursor;
      if (cur && (cur.id !== r.out || cur.n + r.n > maxStack(r.out))) return;
      const res = craftOnce();
      if (cur) cur.n += res.n; else this.cursor = res;
    }
    g.audio.play('click', { vol: 0.4 });
    p.inv.version++;
  }
  creativeClick(ref, btn, shift) {
    const g = this.game, p = g.player, id = ref.itemId;
    if (this.cursor) { this.cursor = null; return; }
    if (shift) { const n = maxStack(id); const slot = [...Array(9).keys()].find(i => !p.inv.get(i)); p.inv.set(slot !== undefined ? slot : p.sel, { id, n, d: 0 }); return; }
    this.cursor = { id, n: btn === 1 ? 1 : maxStack(id), d: 0 };
  }
  refresh() {
    const scr = this.scr; if (!scr) return;
    if (scr.grid) scr.updateOutput();
    for (const r of scr.all) this.renderSlot(r.el, r.get(), this.slotPx);
    this.moveCursor();
    this.game.player.inv.version++;
  }
  playerSlotRefs() {
    const p = this.game.player;
    const refs = [];
    for (let i = 0; i < 36; i++) refs.push({ group: 'player', idx: i, get: () => p.inv.get(i), set: (s) => p.inv.set(i, s) });
    return refs;
  }
  invGrid(refs, from, to, cols) { const g = h('div', { class: 'sgrid', style: { gridTemplateColumns: `repeat(${cols}, var(--s))` } }); for (let i = from; i < to; i++) g.appendChild(this.makeSlot(refs[i])); return g; }
  openScreen(scr) {
    const g = this.game;
    if (this.open) this.closeScreen(true);
    this.open = scr.type; this.scr = scr;
    g.input.releaseLock();
    this.clearScreen(); this.screen.className = 'menu inv';
    this.backFn = () => this.closeScreen();
    this.screen.appendChild(scr.el);
    // close button, since touch has no E/Esc key
    const panel = scr.el.classList.contains('invpanel') ? scr.el : scr.el.querySelector('.invpanel');
    if (panel) {
      const x = h('button', { class: 'invclose', title: 'Close' }, '✕');
      x.addEventListener('pointerdown', (e) => e.stopPropagation());
      x.onclick = () => this.closeScreen();
      panel.classList.add('hasx'); panel.appendChild(x);
    }
    // tapping outside the window drops the held stack, or closes the window if nothing is held
    this.screen.addEventListener('pointerdown', this._bgDown = (e) => {
      if (e.target !== this.screen && e.target !== scr.el) return;
      if (this.cursor) { g.dropStack(this.cursor); this.cursor = null; this.refresh(); } else { e.preventDefault(); this.closeScreen(); }
    });
    this._up = () => this.endDrag();
    window.addEventListener('pointerup', this._up);
    this.refresh();
    g.input.updateTouchVisibility();
  }
  closeScreen(silent) {
    const g = this.game, p = g.player;
    if (!this.open) return;
    const scr = this.scr;
    if (scr && scr.grid) for (let i = 0; i < scr.grid.items.length; i++) { const s = scr.grid.items[i]; if (s) { const l = p.inv.add(s); if (l) g.dropStack({ id: s.id, n: l, d: s.d }); scr.grid.items[i] = null; } }
    if (this.cursor) { const l = p.inv.add(this.cursor); if (l) g.dropStack({ id: this.cursor.id, n: l, d: this.cursor.d }); this.cursor = null; }
    if (scr && scr.onClose) scr.onClose();
    this.open = null; this.scr = null;
    window.removeEventListener('pointerup', this._up);
    this.screen.removeEventListener('pointerdown', this._bgDown);
    this.clearScreen(); this.moveCursor(); this.hideTip();
    if (!silent) { g.input.requestLock(); }
    g.input.updateTouchVisibility();
    p.inv.version++;
  }
  craftGrid(size) {
    const grid = { size, items: new Array(size * size).fill(null) };
    const refs = grid.items.map((_, i) => ({ group: 'grid', idx: i, get: () => grid.items[i], set: (s) => { grid.items[i] = s; } }));
    const out = { kind: 'output', cls: 'out', get: () => { const r = craftMatch(grid.items.map(s => s ? s.id : 0), size); return r ? { id: r.out, n: r.n, d: 0 } : null; }, set: () => { } };
    return { grid, refs, out };
  }
  recipeBook(size, onCraft) {
    const g = this.game, p = g.player;
    const wrap = h('div', { class: 'rbook' });
    const list = h('div', { class: 'rlist' });
    const search = h('input', { type: 'text', placeholder: 'Search recipes…', class: 'rsearch' });
    let showAll = false;
    const allBtn = h('button', { class: 'toggle' }, 'Craftable');
    allBtn.onclick = () => { showAll = !showAll; allBtn.textContent = showAll ? 'All' : 'Craftable'; draw(); };
    const have = () => { const m = new Map(); for (let i = 0; i < 36; i++) { const s = p.inv.get(i); if (s) m.set(s.id, (m.get(s.id) || 0) + s.n); } return m; };
    const canMake = (r, inv) => {
      const need = recipeIngredients(r);
      const pool = new Map(inv);
      for (const { ing, n } of need) {
        let left = n;
        for (const [id, c] of pool) { if (left <= 0) break; if (ingMatch(ing, id)) { const t = Math.min(c, left); left -= t; pool.set(id, c - t); } }
        if (left > 0) return false;
      }
      return true;
    };
    const craft = (r, times) => {
      for (let k = 0; k < times; k++) {
        if (!canMake(r, have())) break;
        for (const { ing, n } of recipeIngredients(r)) {
          p.inv.remove((id) => ingMatch(ing, id), n);
          const rem = typeof ing === 'number' && CRAFT_REMAINS[ITEMS[ing].name];
          if (rem) { const l = p.inv.add({ id: I[rem], n, d: 0 }); if (l) g.dropStack({ id: I[rem], n: l, d: 0 }); }
        }
        const res = { id: r.out, n: r.n, d: 0 };
        const left = p.inv.add(res); if (left) g.dropStack({ id: r.out, n: left, d: 0 });
      }
      g.audio.play('click', { vol: 0.4 });
      if (onCraft) onCraft();
      draw();
    };
    const draw = () => {
      list.innerHTML = '';
      const inv = have(), q = search.value.trim().toLowerCase();
      const seen = new Set();
      const items = [];
      for (const r of RECIPES) {
        if (!recipeFits(r, size)) continue;
        const key = r.out + ':' + r.n; if (seen.has(key)) continue;
        if (q && !itemName(r.out).toLowerCase().includes(q)) continue;
        const ok = canMake(r, inv);
        if (!ok && !showAll) continue;
        seen.add(key); items.push([r, ok]);
      }
      items.sort((a, b) => b[1] - a[1]);
      for (const [r, ok] of items.slice(0, 240)) {
        const el = h('div', { class: 'slot rs' + (ok ? '' : ' dim') });
        this.renderSlot(el, { id: r.out, n: r.n, d: 0 }, this.slotPx);
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!ok) { this.showTip(itemName(r.out) + ' — needs: ' + recipeIngredients(r).map(x => x.n + '× ' + (typeof x.ing === 'string' ? x.ing.slice(1) : itemName(x.ing))).join(', '), e.clientX, e.clientY); return; } craft(r, e.shiftKey ? 64 : 1); });
        let lp = null;
        el.addEventListener('touchstart', () => { lp = setTimeout(() => { lp = null; if (ok) craft(r, 64); }, 500); }, { passive: true });
        el.addEventListener('touchend', () => clearTimeout(lp));
        el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.showTip(itemName(r.out) + ' — ' + recipeIngredients(r).map(x => x.n + '× ' + (typeof x.ing === 'string' ? x.ing.slice(1) : itemName(x.ing))).join(', '), e.clientX, e.clientY); });
        el.addEventListener('pointerleave', () => this.hideTip());
        list.appendChild(el);
      }
      if (!items.length) list.appendChild(h('div', { class: 'empty' }, showAll ? 'No recipes' : 'Nothing craftable yet — gather materials!'));
    };
    search.oninput = draw;
    wrap.append(h('div', { class: 'rhead' }, search, allBtn), list);
    wrap.redraw = draw;
    draw();
    return wrap;
  }
  playerInvSection(refs) {
    return h('div', { class: 'pinv' }, this.invGrid(refs, 9, 36, 9), h('div', { class: 'hbrow' }, this.invGrid(refs, 0, 9, 9)));
  }
  openInventory() {
    const g = this.game, p = g.player;
    if (p.creative) return this.openCreative();
    const refs = this.playerSlotRefs();
    const armor = [0, 1, 2, 3].map(s => ({ group: 'player', kind: 'armor', slot: s, idx: 36 + s, cls: 'armor a' + s, get: () => p.inv.get(36 + s), set: (st) => p.inv.set(36 + s, st) }));
    const cg = this.craftGrid(2);
    const book = this.recipeBook(2, () => this.refresh());
    const scr = { type: 'inventory', grid: cg.grid, playerSlots: refs.concat(armor), containerSlots: null };
    scr.updateOutput = () => { };
    const preview = h('canvas', { class: 'pview', width: 120, height: 170 });
    scr.preview = preview;
    const el = h('div', { class: 'panel invpanel' },
      h('div', { class: 'invtop' },
        h('div', { class: 'armorcol' }, ...armor.map(r => this.makeSlot(r))),
        preview,
        h('div', { class: 'craftarea' }, h('div', { class: 'lbl' }, 'Crafting'), h('div', { class: 'craftrow' }, this.invGrid(cg.refs, 0, 4, 2), h('div', { class: 'arrow' }, '➜'), this.makeSlot(cg.out)))),
      this.playerInvSection(refs));
    scr.el = h('div', { class: 'invwrap' }, el, book);
    scr.all = refs.concat(armor, cg.refs, [cg.out]);
    scr.onRefresh = () => book.redraw();
    this.openScreen(scr);
  }
  openCrafting() {
    const refs = this.playerSlotRefs();
    const cg = this.craftGrid(3);
    const book = this.recipeBook(3, () => this.refresh());
    const scr = { type: 'craft', grid: cg.grid, playerSlots: refs, containerSlots: null, updateOutput: () => { } };
    const el = h('div', { class: 'panel invpanel' }, h('h2', null, 'Crafting Table'),
      h('div', { class: 'craftrow big' }, this.invGrid(cg.refs, 0, 9, 3), h('div', { class: 'arrow' }, '➜'), this.makeSlot(cg.out)),
      this.playerInvSection(refs));
    scr.el = h('div', { class: 'invwrap' }, el, book);
    scr.all = refs.concat(cg.refs, [cg.out]);
    this.openScreen(scr);
  }
  openChest(be, title) {
    const g = this.game;
    if (be.loot) { be.items = new Array(27).fill(null); const loot = rollLoot(be.loot, be.seed); const r = new RNG(be.seed || 1); for (const s of loot) { let k = r.int(27), tries = 0; while (be.items[k] && tries++ < 30) k = r.int(27); be.items[k] = s; } delete be.loot; }
    if (!be.items) be.items = new Array(27).fill(null);
    const refs = this.playerSlotRefs();
    const cs = be.items.map((_, i) => ({ group: 'container', idx: i, get: () => be.items[i], set: (s) => { be.items[i] = s; g.markBE(be); } }));
    const scr = { type: 'chest', playerSlots: refs, containerSlots: cs };
    scr.el = h('div', { class: 'panel invpanel' }, h('h2', null, title || 'Chest'), this.invGrid(cs, 0, 27, 9), h('div', { class: 'lbl' }, 'Inventory'), this.playerInvSection(refs));
    scr.all = refs.concat(cs);
    g.audio.play('chest_open', {});
    scr.onClose = () => g.audio.play('chest_close', {});
    this.openScreen(scr);
  }
  openFurnace(be, title) {
    const g = this.game;
    const refs = this.playerSlotRefs();
    const names = ['input', 'fuel', 'furnaceOut'];
    const cs = [0, 1, 2].map(i => ({ group: 'container', idx: i, kind: names[i], get: () => be.items[i], set: (s) => { be.items[i] = s; g.markBE(be); }, onTake: i === 2 ? () => { if (be.xp >= 1) { g.spawnXP(g.world, g.player.x, g.player.y + 1, g.player.z, Math.floor(be.xp)); be.xp -= Math.floor(be.xp); } } : null }));
    const flame = h('div', { class: 'flame' }, h('div', { class: 'ff' }));
    const arrow = h('div', { class: 'farrow' }, h('div', { class: 'fa' }));
    const scr = { type: 'furnace', playerSlots: refs, containerSlots: cs, be };
    scr.el = h('div', { class: 'panel invpanel' }, h('h2', null, title || 'Furnace'),
      h('div', { class: 'furnace' }, h('div', { class: 'fcol' }, this.makeSlot(cs[0]), flame, this.makeSlot(cs[1])), arrow, h('div', { class: 'fout' }, this.makeSlot(cs[2]))),
      this.playerInvSection(refs));
    scr.all = refs.concat(cs);
    scr.tick = () => { flame.firstChild.style.height = (be.burnMax ? be.burn / be.burnMax * 100 : 0) + '%'; arrow.firstChild.style.width = (be.cook / (be.cookMax || 200) * 100) + '%'; };
    this.openScreen(scr);
  }
  openTrade(v) {
    const g = this.game, p = g.player;
    const prof = v.data.prof || 'none';
    const trades = TRADES[prof] || [];
    const refs = this.playerSlotRefs();
    const list = h('div', { class: 'trades' });
    const draw = () => {
      list.innerHTML = '';
      if (!trades.length) list.appendChild(h('div', { class: 'empty' }, 'This villager has nothing to trade.'));
      for (const tr of trades) {
        const [costs, res] = tr;
        const ok = costs.every(([n, c]) => p.inv.count(id => id === I[n]) >= c);
        const row = h('div', { class: 'trade' + (ok ? '' : ' dim') });
        for (const [n, c] of costs) { const s = h('div', { class: 'slot bare' }); this.renderSlot(s, { id: I[n], n: c, d: 0 }, this.slotPx); row.appendChild(s); }
        row.appendChild(h('div', { class: 'arrow' }, '➜'));
        const rs = h('div', { class: 'slot bare' }); this.renderSlot(rs, { id: I[res[0]], n: res[1], d: 0 }, this.slotPx); row.appendChild(rs);
        row.addEventListener('click', () => {
          if (!costs.every(([n, c]) => p.inv.count(id => id === I[n]) >= c)) { g.audio.play('villager_no', { x: v.x, y: v.y, z: v.z }); return; }
          for (const [n, c] of costs) p.inv.remove(id => id === I[n], c);
          const left = p.inv.add({ id: I[res[0]], n: res[1], d: 0 }); if (left) g.dropStack({ id: I[res[0]], n: left, d: 0 });
          g.audio.play('villager_yes', { x: v.x, y: v.y, z: v.z }); g.spawnXP(g.world, v.x, v.y + 1, v.z, randInt(3, 6));
          this.refresh(); draw();
        });
        list.appendChild(row);
      }
    };
    draw();
    const scr = { type: 'trade', playerSlots: refs, containerSlots: null };
    scr.el = h('div', { class: 'panel invpanel' }, h('h2', null, titleCase(prof === 'none' ? 'villager' : prof)), list, this.playerInvSection(refs));
    scr.all = refs;
    g.audio.play('villager', { x: v.x, y: v.y, z: v.z });
    this.openScreen(scr);
  }
  creativeTabs() {
    const SHAPE_TAB = new Set([R_SLAB, R_STAIRS, R_FENCE, R_GATE, R_DOOR, R_TRAPDOOR, R_PANE]);
    const TOOLS = ['bow', 'arrow', 'shears', 'flint_and_steel', 'fire_charge', 'bucket', 'water_bucket', 'lava_bucket', 'milk_bucket', 'spyglass', 'compass', 'clock', 'fishing_rod', 'ender_pearl'];
    const FUNCTIONAL = ['torch', 'soul_torch', 'lantern', 'soul_lantern', 'ladder', 'rail', 'glowstone', 'sea_lantern', 'jack_o_lantern', 'tnt', 'stone_pressure_plate', 'cauldron', 'spawner', 'bookshelf', 'iron_bars', 'red_bed',
      'campfire', 'soul_campfire', 'chain', 'ochre_froglight', 'verdant_froglight', 'pearlescent_froglight', 'slime_block', 'sponge', 'wet_sponge'];
    const NATURAL = ['grass_block', 'dirt', 'coarse_dirt', 'podzol', 'mycelium', 'sand', 'red_sand', 'gravel', 'clay', 'snow', 'snow_layer', 'ice', 'packed_ice', 'netherrack', 'soul_sand', 'soul_soil', 'magma_block', 'crimson_nylium', 'warped_nylium', 'nether_wart_block', 'warped_wart_block', 'shroomlight', 'obsidian', 'crying_obsidian', 'bedrock', 'pumpkin', 'melon', 'brown_mushroom_block', 'red_mushroom_block', 'mushroom_stem', 'bone_block', 'cobweb', 'basalt', 'blackstone',
      'tuff', 'calcite', 'smooth_basalt', 'dripstone_block', 'mud', 'moss_block', 'moss_carpet', 'rooted_dirt', 'blue_ice', 'amethyst_block', 'budding_amethyst', 'amethyst_cluster', 'pointed_dripstone', 'ancient_debris', 'gilded_blackstone', 'dried_kelp_block', 'glow_lichen'];
    const cat = (d) => {
      if (d.use === 'vehicle') return 'Vehicles';
      if (d.creativeOnly || d.name.startsWith('spawn_egg')) return 'Spawn Eggs';
      if (d.food) return 'Food';
      if (d.tool || d.armor || TOOLS.includes(d.name)) return 'Tools & Combat';
      if (d.block === undefined) return 'Ingredients';
      const b = BLOCKS[d.block];
      if (b.dye !== undefined) return 'Colored';
      if (SHAPE_TAB.has(b.shape)) return 'Shapes';
      if (b.use || FUNCTIONAL.includes(b.name)) return 'Functional';
      if (PLANT[b.id] || LEAVES[b.id] || NATURAL.includes(b.name) || b.name.endsWith('_coral_block') || b.name.endsWith('_ore') || (b.name.endsWith('_log') && !b.name.startsWith('stripped')) || (b.name.endsWith('_stem') && !b.name.startsWith('stripped') && b.name !== 'mushroom_stem')) return 'Natural';
      return 'Building';
    };
    const tabs = { 'Building': [], 'Shapes': [], 'Colored': [], 'Natural': [], 'Functional': [], 'Tools & Combat': [], 'Vehicles': [], 'Food': [], 'Ingredients': [], 'Spawn Eggs': [] };
    for (const k in ITEMS) { const d = ITEMS[k]; if (d.id === 0) continue; tabs[cat(d)].push(d.id); }
    return tabs;
  }
  openCreative() {
    const g = this.game, p = g.player;
    const tabs = this.creativeTabs();
    const refs = this.playerSlotRefs();
    let cur = this.creativeTab || 'Building';
    const grid = h('div', { class: 'cgrid' });
    const search = h('input', { type: 'text', placeholder: 'Search items…', class: 'rsearch' });
    const tabBar = h('div', { class: 'tabs ctabs' });
    const scr = { type: 'creative', playerSlots: refs, containerSlots: null, all: [] };
    const hot = refs.slice(0, 9);
    const trash = { kind: 'trash', cls: 'trash', get: () => null, set: () => { } };
    const survivalView = h('div', { class: 'csurv' });
    const draw = () => {
      tabBar.innerHTML = '';
      for (const t of [...Object.keys(tabs), 'Search', 'Inventory']) { const b = h('button', { class: 'tab' + (t === cur ? ' on' : '') }, t); b.onclick = () => { cur = this.creativeTab = t; draw(); }; tabBar.appendChild(b); }
      grid.innerHTML = ''; survivalView.innerHTML = '';
      search.style.display = cur === 'Search' ? 'block' : 'none';
      const itemRefs = [];
      if (cur === 'Inventory') {
        grid.style.display = 'none'; survivalView.style.display = 'block';
        const armor = [0, 1, 2, 3].map(s => ({ group: 'player', kind: 'armor', slot: s, idx: 36 + s, cls: 'armor a' + s, get: () => p.inv.get(36 + s), set: (st) => p.inv.set(36 + s, st) }));
        survivalView.append(h('div', { class: 'armorrow' }, ...armor.map(r => this.makeSlot(r))), this.invGrid(refs, 9, 36, 9));
        scr.all = refs.concat(armor, [trash]);
      } else {
        grid.style.display = 'grid'; survivalView.style.display = 'none';
        let ids = cur === 'Search' ? Object.keys(ITEMS).map(Number).filter(id => id && itemName(id).toLowerCase().includes(search.value.trim().toLowerCase())) : tabs[cur];
        for (const id of ids) { const r = { kind: 'creative', itemId: id, get: () => ({ id, n: 1, d: 0 }), set: () => { } }; itemRefs.push(r); grid.appendChild(this.makeSlot(r)); }
        scr.all = hot.concat(itemRefs, [trash]);
      }
      this.refresh();
    };
    search.oninput = draw;
    scr.el = h('div', { class: 'panel invpanel creative' }, tabBar, search, grid, survivalView, h('div', { class: 'hbrow' }, this.invGrid(refs, 0, 9, 9), this.makeSlot(trash)));
    scr.all = hot.concat([trash]);
    this.openScreen(scr);
    draw();
  }
  tickScreens() {
    const scr = this.scr; if (!scr) return;
    if (scr.tick) scr.tick();
    if (scr.type === 'furnace' || scr.type === 'chest') { for (const r of scr.containerSlots) this.renderSlot(r.el, r.get(), this.slotPx); }
    if (scr.preview) this.game.drawPreview(scr.preview);
  }
}
