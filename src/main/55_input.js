// ============================================================================
//  Input: keyboard/mouse (pointer lock), touch controls, gamepad
// ============================================================================
const KEYS = { vehicle: 'KeyF', forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', sneak: 'ShiftLeft', sprint: 'ControlLeft', inventory: 'KeyE', drop: 'KeyQ', chat: 'KeyT', command: 'Slash', debug: 'F3', perspective: 'F5', hud: 'F1', screenshot: 'F2', pause: 'Escape', freeLook: 'KeyC' };
class Input {
  constructor(game) {
    this.game = game;
    this.keys = new Set(); this.mouse = { l: false, r: false, m: false };
    this.locked = false; this.lookDX = 0; this.lookDY = 0;
    this.latch = { attack: false, use: false, pick: false };
    this.lastJumpTap = 0; this.lastFwdTap = 0; this.sprintToggle = false;
    this.t = { joy: null, look: null, jx: 0, jy: 0, sneak: false, jump: false, flyUp: false, flyDown: false, aim: null, hold: false };
    this.gp = { prev: [] };
    const cv = game.canvas;
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.l = this.mouse.r = this.mouse.m = false; });
    cv.addEventListener('mousedown', (e) => this.onMouse(e, true));
    window.addEventListener('mouseup', (e) => this.onMouse(e, false));
    window.addEventListener('mousemove', (e) => { if (this.locked) { this.lookDX += e.movementX; this.lookDY += e.movementY; } });
    cv.addEventListener('wheel', (e) => { if (this.game.state !== 'playing' || this.game.ui.open) return; e.preventDefault(); const p = this.game.player; if (!p) return; if (p.vehicle) { const v = p.vehicle, k = e.deltaY > 0 ? 1.1 : 0.9; if (p.vcam === 1 && v.czoom !== undefined) v.czoom = clamp(v.czoom * k, 0.45, 1.3); else v.zoom = clamp(v.zoom * k, 0.55, 2.2); return; } p.sel = (p.sel + (e.deltaY > 0 ? 1 : -1) + 9) % 9; this.game.ui.onSlotChange(); }, { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === cv;
      if (!this.locked && this.game.state === 'playing' && !this.game.ui.open && !IS_TOUCH && !this.game.ui.chatOpen) this.game.pause();
    });
    if (IS_TOUCH) this.buildTouch();
  }
  requestLock() {
    if (IS_TOUCH) return; const cv = this.game.canvas; if (document.pointerLockElement === cv) return;
    // raw input where supported; otherwise plain lock. A refused request (unfocused window, lock exited early) is harmless: the next click retries.
    const plain = () => { try { const q = cv.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch (e) {} };
    try { const p = cv.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(plain); } catch (e) { plain(); }
  }
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }
  down(code) { return this.keys.has(code); }
  onKey(e, down) {
    const g = this.game, ui = g.ui;
    if (ui.chatOpen) { if (down && e.code === 'Escape') ui.closeChat(); return; }
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'F1', 'F2', 'F3', 'F5', 'Tab'].includes(e.code) && g.state === 'playing') e.preventDefault();
    if (down) this.keys.add(e.code); else this.keys.delete(e.code);
    if (!down) return;
    g.audio.init();
    if (g.state !== 'playing') { if (e.code === 'Escape' && g.state === 'paused') g.resume(); else if (e.code === 'Escape') ui.back(); return; }
    const p = g.player;
    if (e.code === KEYS.pause) { if (ui.open) ui.closeScreen(); else g.pause(); return; }
    if (e.code === KEYS.inventory) { if (ui.open) ui.closeScreen(); else ui.openInventory(); return; }
    if (ui.open) return;
    if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= 9) { p.sel = n - 1; ui.onSlotChange(); } }
    if (e.code === KEYS.drop) g.dropHeld(e.ctrlKey);
    if (e.code === KEYS.debug) { ui.debug = !ui.debug; }
    if (e.code === KEYS.hud) { SETTINGS.hudHidden = !SETTINGS.hudHidden; ui.applyHudVisibility(); }
    if (e.code === KEYS.perspective) this.cycleCamera(p);
    if (e.code === KEYS.vehicle && !e.repeat) g.toggleVehicle();
    if (e.code === KEYS.screenshot) g.screenshot();
    if (e.code === KEYS.chat) { e.preventDefault(); ui.openChat(''); }
    if (e.code === KEYS.command) { e.preventDefault(); ui.openChat('/'); }
    if (e.code === KEYS.jump && !e.repeat) {
      const t = now();
      if (t - this.lastJumpTap < 300 && (p.creative || p.spectator)) { p.flying = !p.flying; p.vy = 0; }
      this.lastJumpTap = t;
    }
    if (e.code === KEYS.forward && !e.repeat) { const t = now(); if (t - this.lastFwdTap < 280) this.sprintToggle = true; this.lastFwdTap = t; }
  }
  onMouse(e, down) {
    const g = this.game;
    g.audio.init();
    if (down && g.state === 'playing' && !g.ui.open && !this.locked && !IS_TOUCH) { this.requestLock(); return; }
    if (!this.locked) { if (!down) { this.mouse.l = this.mouse.r = this.mouse.m = false; } return; }
    if (e.button === 0) { this.mouse.l = down; if (down) this.latch.attack = true; }
    if (e.button === 2) { this.mouse.r = down; if (down) this.latch.use = true; }
    if (e.button === 1) { this.mouse.m = down; if (down) { this.latch.pick = true; e.preventDefault(); } }
  }
  // ---------------------------------------------------------------- touch
  buildTouch() {
    const g = this.game;
    const root = this.touchRoot = h('div', { id: 'touch' });
    const S = SETTINGS.buttonSize || 1;
    const btn = (id, label, cls) => { const b = h('div', { class: 'tbtn ' + (cls || ''), id }, label); root.appendChild(b); return b; };
    this.joyBase = h('div', { class: 'joy' }, this.joyKnob = h('div', { class: 'knob' }));
    root.appendChild(this.joyBase);
    const jump = btn('t-jump', '⬆', 'big'), sneak = btn('t-sneak', '⇩'), inv = btn('t-inv', '⋯'), pause = btn('t-pause', '❚❚'), cam = btn('t-cam', '👁'), up = btn('t-up', '▲'), dn = btn('t-down', '▼'), chat = btn('t-chat', '💬'), tp = btn('t-tp', 'TP'), drop = btn('t-drop', '⇲'), sprint = btn('t-sprint', '»');
    const hold = (el, on, off) => {
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); g.audio.init(); el.classList.add('on'); on(); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.remove('on'); if (off) off(); }, { passive: false });
      el.addEventListener('touchcancel', () => { el.classList.remove('on'); if (off) off(); });
    };
    hold(jump, () => { this.t.jump = true; const t = now(); const p = g.player; if (p && t - this.lastJumpTap < 320 && (p.creative || p.spectator)) { p.flying = !p.flying; p.vy = 0; } this.lastJumpTap = t; }, () => { this.t.jump = false; });
    hold(sneak, () => { this.t.sneak = !this.t.sneak; sneak.classList.toggle('lock', this.t.sneak); });
    hold(up, () => { this.t.flyUp = true; }, () => { this.t.flyUp = false; });
    hold(dn, () => { this.t.flyDown = true; }, () => { this.t.flyDown = false; });
    hold(inv, () => { if (g.ui.open) g.ui.closeScreen(); else g.ui.openInventory(); });
    hold(pause, () => g.pause());
    hold(cam, () => { const p = g.player; if (p) this.cycleCamera(p); });
    hold(chat, () => g.ui.openChat(''));
    hold(tp, () => g.ui.chatWith('/tp '));
    hold(drop, () => g.dropHeld(false));
    hold(sprint, () => { this.sprintToggle = !this.sprintToggle; sprint.classList.toggle('lock', this.sprintToggle); });
    const onStart = (e) => {
      if (g.state !== 'playing' || g.ui.open) return;
      e.preventDefault(); g.audio.init();
      for (const tc of e.changedTouches) {
        const x = tc.clientX, y = tc.clientY;
        if (x < window.innerWidth * 0.38 && y > window.innerHeight * 0.3 && !this.t.joy) {
          this.t.joy = { id: tc.identifier, x, y }; this.joyBase.style.display = 'block';
          this.joyBase.style.left = (x - 60 * S) + 'px'; this.joyBase.style.top = (y - 60 * S) + 'px'; this.joyKnob.style.transform = 'translate(0px,0px)';
        } else if (!this.t.look) {
          const L = this.t.look = { id: tc.identifier, x, y, sx: x, sy: y, t: now(), moved: 0, hold: false };
          this.t.aim = [x, y];
          L.timer = setTimeout(() => { if (this.t.look === L && L.moved < 14) { L.hold = true; this.t.hold = true; this.latch.attack = true; } }, 260);
        }
      }
    };
    const onMove = (e) => {
      if (g.state !== 'playing') return;
      e.preventDefault();
      for (const tc of e.changedTouches) {
        const J = this.t.joy, L = this.t.look;
        if (J && tc.identifier === J.id) {
          let dx = tc.clientX - J.x, dy = tc.clientY - J.y; const r = 55 * S, l = Math.hypot(dx, dy);
          if (l > r) { dx = dx / l * r; dy = dy / l * r; }
          this.t.jx = dx / r; this.t.jy = -dy / r;
          this.joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
          this.joySprint = this.t.jy > 0.93 && l > r * 0.95;
        } else if (L && tc.identifier === L.id) {
          const dx = tc.clientX - L.x, dy = tc.clientY - L.y;
          L.moved += Math.abs(dx) + Math.abs(dy); L.x = tc.clientX; L.y = tc.clientY;
          const k = 2.2;
          this.lookDX += dx * k; this.lookDY += dy * k;
          this.t.aim = [tc.clientX, tc.clientY];
        }
      }
    };
    const onEnd = (e) => {
      for (const tc of e.changedTouches) {
        const J = this.t.joy, L = this.t.look;
        if (J && tc.identifier === J.id) { this.t.joy = null; this.t.jx = this.t.jy = 0; this.joyBase.style.display = 'none'; this.joySprint = false; }
        else if (L && tc.identifier === L.id) {
          clearTimeout(L.timer);
          if (!L.hold && L.moved < 14 && now() - L.t < 350) { this.t.aim = [L.x, L.y]; this.latch.tap = true; }
          this.t.look = null; this.t.hold = false;
          if (!this.latch.tap) this.t.aim = null;
        }
      }
    };
    const cv = g.canvas;
    cv.addEventListener('touchstart', onStart, { passive: false });
    cv.addEventListener('touchmove', onMove, { passive: false });
    cv.addEventListener('touchend', onEnd, { passive: false });
    cv.addEventListener('touchcancel', onEnd, { passive: false });
    document.body.appendChild(root);
    this.applyTouchLayout();
  }
  applyTouchLayout() {
    if (!this.touchRoot) return;
    const S = SETTINGS.buttonSize || 1;
    this.touchRoot.style.setProperty('--tb', (54 * S) + 'px');
    this.touchRoot.style.opacity = SETTINGS.buttonOpacity;
  }
  updateTouchVisibility() {
    if (!this.touchRoot) return;
    const g = this.game, p = g.player;
    const show = g.state === 'playing' && !g.ui.open;
    this.touchRoot.style.display = show ? 'block' : 'none';
    if (p) { const fly = p.flying; $('#t-up').style.display = fly ? 'flex' : 'none'; $('#t-down').style.display = fly ? 'flex' : 'none'; $('#t-sneak').style.display = fly ? 'none' : 'flex'; }
    const tp = $('#t-tp'); if (tp) tp.style.display = g.meta && g.meta.cheats ? 'flex' : 'none';
  }
  // F5: chase / cockpit / far chase in a vehicle, first / third / front person on foot
  cycleCamera(p) {
    if (!p.vehicle) { p.camMode = (p.camMode + 1) % 3; return; }
    p.vcam = (p.vcam + 1) % 3;
    if (p.vehicle.onCamChange) p.vehicle.onCamChange(p);
  }
  // ---------------------------------------------------------------- per-frame look + per-tick state
  applyLook(p, dt) {
    // slower turning while zoomed in (spyglass, drawn bow)
    const sens = (0.0015 + SETTINGS.sensitivity * 0.005) * Math.min(1, Math.max(0.12, p.fovMul || 1));
    this.pollGamepad(p, dt);
    // flying from the cockpit the mouse is the control stick, or the pilot's head while free look is held
    const v = p.vehicle;
    if (v && v.takesMouse && v.takesMouse(p)) {
      const look = v.head.hold = this.keys.has(KEYS.freeLook) || this.mouse.m;
      if (this.lookDX || this.lookDY) { v.mouseInput(this.lookDX * sens, this.lookDY * sens * (SETTINGS.invertY ? -1 : 1), look); this.lookDX = this.lookDY = 0; }
      return;
    }
    if (this.lookDX || this.lookDY) {
      p.yaw += this.lookDX * sens;
      p.pitch -= this.lookDY * sens * (SETTINGS.invertY ? -1 : 1);
      p.pitch = clamp(p.pitch, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);
      this.lookDX = this.lookDY = 0;
    }
  }
  pollGamepad(p, dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && [...pads].find(x => x && x.connected);
    if (!gp) { this.gpState = null; return; }
    const g = this.game, prev = this.gp.prev, b = gp.buttons.map(x => x.pressed || x.value > 0.5);
    const dz = (v) => Math.abs(v) < 0.15 ? 0 : v;
    const pressed = (i) => b[i] && !prev[i];
    if (g.state === 'playing' && !g.ui.open) {
      const lx = dz(gp.axes[2] || 0), ly = dz(gp.axes[3] || 0);
      const k = 700 * dt;
      this.lookDX += Math.sign(lx) * lx * lx * k; this.lookDY += Math.sign(ly) * ly * ly * k;
      if (pressed(4)) { p.sel = (p.sel + 8) % 9; g.ui.onSlotChange(); }
      if (pressed(5)) { p.sel = (p.sel + 1) % 9; g.ui.onSlotChange(); }
      if (pressed(7)) this.latch.attack = true;
      if (pressed(6)) this.latch.use = true;
      if (pressed(3)) g.ui.openInventory();
      if (pressed(9)) g.pause();
      if (pressed(11)) this.cycleCamera(p);
      if (pressed(13)) g.dropHeld(false);
      if (pressed(0)) { const t = now(); if (t - this.lastJumpTap < 300 && (p.creative || p.spectator)) { p.flying = !p.flying; p.vy = 0; } this.lastJumpTap = t; }
    } else if (g.ui.open && (pressed(1) || pressed(3))) g.ui.closeScreen();
    else if (g.state === 'paused' && pressed(9)) g.resume();
    this.gpState = { mx: dz(gp.axes[0] || 0), my: dz(gp.axes[1] || 0), jump: b[0], sneak: b[1], sprint: b[10], attack: b[7], use: b[6] };
    this.gp.prev = b;
  }
  vehicleState() {
    const g = this.game, K = (c) => this.keys.has(c);
    const st = this.vst || (this.vst = { f: 0, s: 0, up: false, down: false, boost: false, fire1: false, fire2: false });
    if (g.ui.open || g.ui.chatOpen || g.state !== 'playing') { st.f = st.s = 0; st.up = st.down = st.boost = st.fire1 = st.fire2 = false; return st; }
    st.f = (K('KeyW') ? 1 : 0) - (K('KeyS') ? 1 : 0); st.s = (K('KeyD') ? 1 : 0) - (K('KeyA') ? 1 : 0);
    st.up = K('Space'); st.down = K('ShiftLeft') || K('ShiftRight'); st.boost = K('ControlLeft') || K('ControlRight') || K('KeyR');
    st.fire1 = this.mouse.l; st.fire2 = this.mouse.r;
    if (IS_TOUCH) { st.f += this.t.jy; st.s += this.t.jx; st.up = st.up || this.t.jump || this.t.flyUp; st.down = st.down || this.t.sneak || this.t.flyDown; st.boost = st.boost || this.joySprint || this.sprintToggle; st.fire1 = st.fire1 || this.t.hold; }
    const G = this.gpState;
    if (G) { st.f -= G.my; st.s += G.mx; st.up = st.up || G.jump; st.down = st.down || G.sneak; st.boost = st.boost || G.sprint; st.fire1 = st.fire1 || G.attack; st.fire2 = st.fire2 || G.use; }
    st.f = clamp(st.f, -1, 1); st.s = clamp(st.s, -1, 1);
    return st;
  }
  state() {
    const g = this.game, ui = g.ui, K = (k) => this.keys.has(KEYS[k]);
    const blocked = ui.open || g.state !== 'playing';
    let f = 0, s = 0, jump = false, sneak = false, sprint = false, attack = false, use = false;
    if (!blocked) {
      f = (K('forward') ? 1 : 0) - (K('back') ? 1 : 0); s = (K('right') ? 1 : 0) - (K('left') ? 1 : 0);
      jump = K('jump'); sneak = K('sneak') || this.keys.has('ShiftRight'); sprint = K('sprint') || this.sprintToggle;
      attack = this.mouse.l; use = this.mouse.r;
      if (IS_TOUCH) {
        f += this.t.jy; s += this.t.jx;
        jump = jump || this.t.jump || this.t.flyUp; sneak = sneak || this.t.sneak || this.t.flyDown;
        sprint = sprint || this.joySprint;
        attack = attack || this.t.hold;
      }
      const G = this.gpState;
      if (G) { f -= G.my; s += G.mx; jump = jump || G.jump; sneak = sneak || G.sneak; sprint = sprint || G.sprint; attack = attack || G.attack; use = use || G.use; }
      if (f <= 0) this.sprintToggle = IS_TOUCH ? this.sprintToggle : false;
    }
    const st = { f: clamp(f, -1, 1), s: clamp(s, -1, 1), jump, sneak, sprint, attack, use, attackPressed: this.latch.attack && !blocked, usePressed: this.latch.use && !blocked, pick: this.latch.pick && !blocked, tap: this.latch.tap && !blocked };
    this.latch.attack = this.latch.use = this.latch.pick = this.latch.tap = false;
    if (st.usePressed) st.use = true;
    return st;
  }
}
