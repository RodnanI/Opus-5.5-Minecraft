// ============================================================================
//  Procedural audio: synthesized SFX, positional panning, generative music
// ============================================================================
class Audio {
  constructor(game) { this.game = game; this.ctx = null; this.ok = false; this.last = {}; this.musicT = 30; this.ambT = 5; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      const ctx = this.ctx = new C();
      this.master = ctx.createGain(); const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(ctx.destination);
      this.sfx = ctx.createGain(); this.sfx.connect(this.master);
      this.music = ctx.createGain(); this.music.connect(this.master);
      this.amb = ctx.createGain(); this.amb.connect(this.master);
      // reverb
      const len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      this.verb = ctx.createConvolver(); this.verb.buffer = ir;
      this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.35; this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
      this.caveSend = ctx.createGain(); this.caveSend.gain.value = 0; this.caveSend.connect(this.verb);
      this.sfx.connect(this.caveSend);
      const nl = ctx.sampleRate * 2; this.noiseBuf = ctx.createBuffer(1, nl, ctx.sampleRate); const nd = this.noiseBuf.getChannelData(0); for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
      this.brownBuf = ctx.createBuffer(1, nl, ctx.sampleRate); const bd = this.brownBuf.getChannelData(0); let l = 0; for (let i = 0; i < nl; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = l * 3.5; }
      this.ok = true;
      this.applyVolumes();
    } catch (e) { console.warn('audio init failed', e); }
  }
  applyVolumes() {
    if (!this.ok) return;
    const S = SETTINGS;
    this.master.gain.value = S.masterVol; this.sfx.gain.value = S.sfxVol; this.music.gain.value = S.musicVol * 0.5; this.amb.gain.value = S.ambientVol;
  }
  // ---------------------------------------------------------------- primitives
  out(opts) {
    const ctx = this.ctx;
    let node = this.sfx;
    let g = 1;
    if (opts && opts.x !== undefined && this.game.player) {
      const p = this.game.player, cam = this.game.camera;
      const dx = opts.x - p.x, dy = opts.y - (p.y + 1.6), dz = opts.z - p.z;
      const d = Math.hypot(dx, dy, dz);
      g = Math.max(0, 1 - d / (opts.range || 16));
      if (g <= 0.001) return null;
      if (ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        const rx = Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
        pan.pan.value = clamp((dx * rx + dz * rz) / Math.max(d, 1), -0.85, 0.85);
        pan.connect(this.sfx); node = pan;
      }
    }
    const gain = ctx.createGain(); gain.gain.value = g * (opts && opts.vol !== undefined ? opts.vol : 1);
    gain.connect(node);
    return gain;
  }
  noise(dst, t, dur, type, f, q, vol, att, brown) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = brown ? this.brownBuf : this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (att || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dst);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    return fl;
  }
  tone(dst, t, type, f0, f1, dur, vol, att) {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (att || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dst); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  voice(dst, t, f0, f1, dur, vol, formant, vib) {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (vib) { const l = ctx.createOscillator(); l.frequency.value = vib[0]; const lg = ctx.createGain(); lg.gain.value = vib[1]; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = formant; f.Q.value = 2.5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = formant * 2.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(f2); f2.connect(g); g.connect(dst); o.start(t); o.stop(t + dur + 0.05);
  }
  // ---------------------------------------------------------------- sound table
  play(name, opts) {
    if (!this.ok || SETTINGS.sfxVol <= 0) return;
    opts = opts || {};
    const nowT = performance.now();
    const k = name + (opts.mat || '');
    if (this.last[k] && nowT - this.last[k] < 30) return;
    this.last[k] = nowT;
    const dst = this.out(opts); if (!dst) return;
    const t = this.ctx.currentTime + 0.005, p = opts.pitch || 1, r = Math.random;
    const M = { stone: [1500, 1.4], wood: [650, 2.0], grass: [2800, 0.8], gravel: [1100, 0.9], sand: [2200, 0.7], glass: [3000, 1.5], wool: [500, 0.6], snow: [2400, 1.0], metal: [1800, 3], nether: [900, 1.2], soul: [600, 0.8] };
    switch (name) {
      case 'dig': case 'step': case 'place': case 'break': {
        const m = M[opts.mat] || M.stone;
        const vol = (name === 'break' ? 0.5 : name === 'place' ? 0.45 : name === 'dig' ? 0.3 : 0.25);
        const dur = name === 'break' ? 0.22 : name === 'step' ? 0.1 : 0.13;
        this.noise(dst, t, dur, 'bandpass', m[0] * p * (0.85 + r() * 0.3), m[1], vol, 0.003, opts.mat === 'gravel' || opts.mat === 'soul');
        if (opts.mat === 'wood') this.tone(dst, t, 'triangle', 190 * p * (0.9 + r() * 0.2), 120, 0.08, vol * 0.6);
        if (opts.mat === 'stone' && name !== 'step') this.tone(dst, t, 'sine', 140, 70, 0.07, vol * 0.4);
        if (opts.mat === 'metal') for (const f of [620, 1470, 2310]) this.tone(dst, t, 'sine', f * p, f * p, name === 'break' ? 0.5 : 0.25, vol * 0.12);
        if (opts.mat === 'glass' && name === 'break') for (let i = 0; i < 5; i++) this.tone(dst, t + i * 0.02, 'sine', 2200 + r() * 3000, 1800 + r() * 2000, 0.3, 0.06);
        if (name === 'break') this.noise(dst, t + 0.05, dur * 0.8, 'bandpass', m[0] * 0.7, m[1], vol * 0.6, 0.003);
        break;
      }
      case 'note': {
        // note block: the block underneath picks the instrument (wood = bass, metal = bell, glass = chime, else harp)
        const f = 185 * Math.pow(2, (opts.pitch || 0) / 12), m = opts.mat;
        if (m === 'wood') { this.tone(dst, t, 'triangle', f / 2, f / 2, 0.55, 0.45); this.tone(dst, t, 'sine', f, f, 0.3, 0.12); }
        else if (m === 'metal') { this.tone(dst, t, 'sine', f * 2, f * 2, 1.3, 0.25); this.tone(dst, t, 'sine', f * 5.04, f * 5.04, 0.6, 0.05); }
        else if (m === 'glass') this.tone(dst, t, 'sine', f * 4, f * 4, 0.3, 0.2);
        else { this.tone(dst, t, 'triangle', f * 2, f * 2, 0.8, 0.32); this.tone(dst, t, 'sine', f * 4, f * 4, 0.35, 0.07); }
        break;
      }
      case 'hurt': this.voice(dst, t, 260 * p, 150, 0.22, 0.35, 700); break;
      case 'fall_small': this.noise(dst, t, 0.12, 'lowpass', 500, 1, 0.5); break;
      case 'fall_big': this.noise(dst, t, 0.25, 'lowpass', 350, 1, 0.8); this.tone(dst, t, 'sine', 90, 40, 0.2, 0.4); break;
      case 'pop': this.tone(dst, t, 'sine', 600 * p, 1100 * p, 0.07, 0.25); break;
      case 'xp': this.tone(dst, t, 'sine', 1500 * p, 1500 * p, 0.12, 0.12); this.tone(dst, t + 0.03, 'sine', 2250 * p, 2250 * p, 0.1, 0.07); break;
      case 'levelup': [523, 659, 784, 1046].forEach((f, i) => this.tone(dst, t + i * 0.09, 'triangle', f, f, 0.35, 0.18)); break;
      case 'click': this.tone(dst, t, 'square', 1200, 900, 0.03, 0.08); break;
      case 'eat': this.noise(dst, t, 0.07, 'bandpass', 1800 * p, 1.2, 0.3); break;
      case 'burp': this.voice(dst, t, 140, 110, 0.25, 0.3, 500); break;
      case 'hit': this.noise(dst, t, 0.08, 'lowpass', 900, 1, 0.5); this.tone(dst, t, 'sine', 180, 90, 0.08, 0.3); break;
      case 'crit': this.noise(dst, t, 0.1, 'highpass', 2500, 1, 0.4); this.tone(dst, t, 'sine', 240, 110, 0.1, 0.35); break;
      case 'bow': this.tone(dst, t, 'triangle', 300, 120, 0.18, 0.3); this.noise(dst, t, 0.12, 'highpass', 3000, 1, 0.2); break;
      case 'arrow_hit': this.noise(dst, t, 0.06, 'bandpass', 1400, 2, 0.35); this.tone(dst, t, 'triangle', 380, 250, 0.06, 0.2); break;
      case 'throw': this.noise(dst, t, 0.15, 'bandpass', 1200, 1, 0.2, 0.05); break;
      case 'explosion': {
        const s = this.noise(dst, t, 1.6, 'lowpass', 900, 0.8, 1.0, 0.005, true); s.frequency.exponentialRampToValueAtTime(80, t + 1.4);
        this.tone(dst, t, 'sine', 60, 28, 1.0, 0.9); this.noise(dst, t, 0.4, 'bandpass', 2000, 0.5, 0.5);
        if (this.verb) { const g2 = this.ctx.createGain(); g2.gain.value = 0.5; g2.connect(this.verb); this.noise(g2, t, 1.2, 'lowpass', 500, 0.8, 0.6, 0.005, true); }
        break;
      }
      case 'smallboom': this.noise(dst, t, 0.5, 'lowpass', 700, 0.8, 0.6, 0.005, true); this.tone(dst, t, 'sine', 90, 40, 0.4, 0.4); break;
      case 'fuse': { const s = this.noise(dst, t, 1.4, 'highpass', 3000, 0.7, 0.35, 0.3); s.frequency.linearRampToValueAtTime(5000, t + 1.4); break; }
      case 'fizz': this.noise(dst, t, 0.5, 'highpass', 4000, 0.5, 0.25, 0.02); break;
      case 'ignite': this.noise(dst, t, 0.25, 'bandpass', 2500, 1, 0.35); this.tone(dst, t, 'square', 800, 300, 0.05, 0.1); break;
      case 'lava_pop': this.tone(dst, t, 'sine', 300 + r() * 200, 80, 0.08, 0.25); break;
      case 'splash': this.noise(dst, t, 0.4, 'bandpass', 1300, 0.7, 0.5, 0.01); break;
      case 'bucket_fill': case 'bucket_empty': this.noise(dst, t, 0.35, 'bandpass', 900, 1, 0.4, 0.02); this.tone(dst, t, 'sine', 400, 700, 0.2, 0.1); break;
      case 'bucket_lava': case 'bucket_empty_lava': this.noise(dst, t, 0.4, 'lowpass', 600, 1, 0.5, 0.02, true); break;
      case 'door_open': case 'door_close': this.tone(dst, t, 'triangle', name === 'door_open' ? 220 : 180, 140, 0.12, 0.3); this.noise(dst, t, 0.1, 'bandpass', 700, 2, 0.3); break;
      case 'chest_open': case 'chest_close': { const o = this.voice(dst, t, name === 'chest_open' ? 180 : 260, name === 'chest_open' ? 300 : 150, 0.3, 0.12, 900); void o; this.noise(dst, t + 0.25, 0.08, 'lowpass', 600, 1, 0.3); break; }
      case 'shear': this.noise(dst, t, 0.08, 'highpass', 4000, 1, 0.3); this.noise(dst, t + 0.1, 0.08, 'highpass', 4000, 1, 0.3); break;
      case 'milk': this.noise(dst, t, 0.4, 'bandpass', 1000, 2, 0.3, 0.05); break;
      case 'break_tool': this.tone(dst, t, 'square', 900, 300, 0.2, 0.15); this.noise(dst, t, 0.2, 'highpass', 3000, 1, 0.3); break;
      case 'portal_trigger': { const s = this.voice(dst, t, 80, 160, 3.5, 0.12, 400, [5, 20]); void s; this.noise(dst, t, 3.5, 'bandpass', 600, 3, 0.1, 1.5); break; }
      case 'portal_open': [220, 277, 330, 440].forEach((f, i) => this.tone(dst, t + i * 0.08, 'sawtooth', f, f * 1.01, 1.2, 0.05)); break;
      case 'portal_travel': this.noise(dst, t, 2.5, 'bandpass', 400, 2, 0.4, 0.3); this.voice(dst, t, 60, 220, 2.5, 0.2, 500, [3, 10]); break;
      case 'thunder': { const s = this.noise(dst, t, 3.5, 'lowpass', 400, 0.5, 1.0, 0.01, true); s.frequency.exponentialRampToValueAtTime(60, t + 3); this.noise(dst, t, 0.3, 'lowpass', 2000, 0.5, 0.6); break; }
      // ---------------- mobs (original synthesized voices)
      case 'pig': this.voice(dst, t, 190 * p * (0.9 + r() * 0.2), 150, 0.28, 0.25, 700, [18, 25]); break;
      case 'pig_hurt': this.voice(dst, t, 320, 200, 0.2, 0.35, 900, [30, 40]); break;
      case 'pig_death': this.voice(dst, t, 280, 120, 0.5, 0.35, 800, [25, 30]); break;
      case 'cow': this.voice(dst, t, 115 * (0.9 + r() * 0.2), 95, 0.9, 0.3, 450, [4, 5]); break;
      case 'cow_hurt': this.voice(dst, t, 170, 120, 0.4, 0.35, 550, [8, 10]); break;
      case 'cow_death': this.voice(dst, t, 150, 70, 0.9, 0.35, 450, [5, 8]); break;
      case 'sheep': this.voice(dst, t, 310 * (0.9 + r() * 0.2), 280, 0.55, 0.22, 1100, [9, 30]); break;
      case 'sheep_hurt': case 'sheep_death': this.voice(dst, t, 380, 250, 0.4, 0.3, 1200, [12, 40]); break;
      case 'chicken': for (let i = 0; i < 3; i++) this.tone(dst, t + i * 0.08, 'triangle', 1300 + r() * 500, 900, 0.06, 0.12); break;
      case 'chicken_hurt': case 'chicken_death': this.tone(dst, t, 'triangle', 1800, 700, 0.15, 0.2); break;
      case 'villager': this.voice(dst, t, 170 * (0.9 + r() * 0.3), 140 + r() * 60, 0.35, 0.22, 650, [6, 8]); break;
      case 'villager_hurt': this.voice(dst, t, 240, 160, 0.25, 0.3, 700); break;
      case 'villager_death': this.voice(dst, t, 200, 90, 0.6, 0.3, 600); break;
      case 'villager_yes': this.voice(dst, t, 160, 210, 0.25, 0.25, 700); break;
      case 'villager_no': this.voice(dst, t, 200, 130, 0.3, 0.25, 600); break;
      case 'zombie': this.voice(dst, t, 90 * (0.9 + r() * 0.2), 70, 1.0, 0.3, 380, [3, 6]); this.noise(dst, t, 0.8, 'lowpass', 500, 1, 0.1, 0.2); break;
      case 'zombie_hurt': case 'ghoul_hurt': this.voice(dst, t, 140, 80, 0.35, 0.35, 450); break;
      case 'zombie_death': case 'ghoul_death': this.voice(dst, t, 110, 45, 0.9, 0.35, 380, [4, 8]); break;
      case 'ghoul': this.voice(dst, t, 75 * (0.9 + r() * 0.2), 55, 1.2, 0.3, 320, [2, 4]); this.noise(dst, t, 1, 'lowpass', 300, 1, 0.12, 0.3, true); break;
      case 'skeleton': for (let i = 0; i < 4; i++) this.noise(dst, t + i * 0.06 + r() * 0.02, 0.03, 'bandpass', 2500 + r() * 1500, 4, 0.25); break;
      case 'skeleton_hurt': case 'skeleton_death': for (let i = 0; i < 7; i++) this.noise(dst, t + i * 0.04, 0.03, 'bandpass', 2000 + r() * 2000, 4, 0.3); break;
      case 'spider': this.noise(dst, t, 0.35, 'highpass', 3500, 1, 0.2, 0.05); for (let i = 0; i < 3; i++) this.noise(dst, t + 0.1 * i, 0.02, 'bandpass', 5000, 5, 0.15); break;
      case 'spider_hurt': case 'spider_death': this.noise(dst, t, 0.4, 'bandpass', 2500, 2, 0.35, 0.01); break;
      case 'boomcap': this.voice(dst, t, 400, 520, 0.2, 0.08, 1500); break;
      case 'boomcap_hurt': case 'boomcap_death': this.noise(dst, t, 0.25, 'bandpass', 800, 1.5, 0.4, 0.01, true); this.voice(dst, t, 300, 180, 0.25, 0.15, 1000); break;
      case 'witch': this.voice(dst, t, 260, 380, 0.4, 0.18, 1400, [7, 25]); break;
      case 'witch_hurt': case 'witch_death': this.voice(dst, t, 420, 220, 0.4, 0.25, 1300, [9, 30]); break;
      case 'imp': this.noise(dst, t, 0.6, 'bandpass', 700, 1.5, 0.2, 0.15, true); this.voice(dst, t, 220, 300, 0.4, 0.1, 900, [11, 30]); break;
      case 'imp_hurt': case 'imp_death': this.voice(dst, t, 420, 200, 0.35, 0.3, 1000, [14, 40]); break;
      case 'fireball': { const s = this.noise(dst, t, 0.6, 'lowpass', 1500, 0.8, 0.45, 0.01, true); s.frequency.exponentialRampToValueAtTime(300, t + 0.5); break; }
      case 'slime': this.noise(dst, t, 0.15, 'lowpass', 400, 2, 0.35, 0.01, true); this.tone(dst, t, 'sine', 120, 60, 0.12, 0.3); break;
      case 'slime_hurt': case 'slime_death': this.noise(dst, t, 0.2, 'lowpass', 600, 2, 0.4, 0.01, true); break;
      case 'sentinel': this.tone(dst, t, 'square', 70, 60, 0.3, 0.06); break;
      case 'plasma': this.tone(dst, t, 'sawtooth', 1500 * p * (0.95 + r() * 0.1), 210, 0.13, 0.13); this.noise(dst, t, 0.06, 'highpass', 3500, 0.7, 0.16); this.tone(dst, t, 'sine', 190, 55, 0.11, 0.3); break;
      case 'blaster': this.tone(dst, t, 'square', 950 * p * (0.95 + r() * 0.1), 170, 0.1, 0.08); this.tone(dst, t, 'sawtooth', 2100, 420, 0.06, 0.07); this.noise(dst, t, 0.05, 'bandpass', 2600, 1.5, 0.14); break;
      case 'fusion': this.tone(dst, t, 'sawtooth', 320, 55, 0.5, 0.28); this.noise(dst, t, 0.4, 'lowpass', 1300, 1, 0.45, 0.01, true); this.tone(dst, t, 'sine', 950, 110, 0.32, 0.2); break;
      case 'missile': { const s = this.noise(dst, t, 1.3, 'bandpass', 650, 0.8, 0.65, 0.03); s.frequency.exponentialRampToValueAtTime(2400, t + 1.0); this.tone(dst, t, 'sine', 95, 45, 0.3, 0.5); break; }
      case 'rocket': { const s = this.noise(dst, t, 0.7, 'bandpass', 900, 0.9, 0.45, 0.01); s.frequency.exponentialRampToValueAtTime(2300, t + 0.6); this.tone(dst, t, 'sine', 120, 50, 0.2, 0.35); break; }
      case 'impact': this.noise(dst, t, 0.12, 'bandpass', 1800 * (0.8 + r() * 0.4), 1.2, 0.3); this.tone(dst, t, 'sine', 320, 90, 0.08, 0.14); break;
      case 'lock': this.tone(dst, t, 'square', 1250, 1250, 0.06, 0.06); break;
      case 'warn': this.tone(dst, t, 'square', 880, 880, 0.17, 0.08); this.tone(dst, t + 0.2, 'square', 660, 660, 0.17, 0.08); break;
      case 'veh_enter': this.tone(dst, t, 'triangle', 300, 900, 0.25, 0.18); this.noise(dst, t, 0.2, 'bandpass', 3000, 2, 0.12); break;
      case 'veh_exit': this.tone(dst, t, 'triangle', 900, 300, 0.25, 0.18); this.noise(dst, t, 0.2, 'bandpass', 2500, 2, 0.12); break;
      case 'veh_hop': this.noise(dst, t, 0.35, 'lowpass', 900, 1, 0.5, 0.01, true); this.tone(dst, t, 'sine', 140, 60, 0.3, 0.35); break;
      case 'veh_land': this.noise(dst, t, 0.4, 'lowpass', 600, 1, 0.6, 0.005, true); this.tone(dst, t, 'sine', 80, 40, 0.35, 0.5); break;
      case 'veh_liftoff': { const s = this.noise(dst, t, 1.2, 'bandpass', 500, 0.7, 0.4, 0.2); s.frequency.exponentialRampToValueAtTime(1600, t + 1); break; }
      case 'veh_overheat': this.noise(dst, t, 0.6, 'highpass', 4000, 0.7, 0.3, 0.02); this.tone(dst, t, 'square', 440, 220, 0.4, 0.1); break;
      case 'bomb_drop': this.tone(dst, t, 'sine', 1500, 420, 1.8, 0.1, 0.25); this.noise(dst, t, 0.3, 'bandpass', 900, 1, 0.2, 0.01); break;
      case 'cannon': this.noise(dst, t, 1.3, 'lowpass', 900, 0.8, 1.0, 0.003, true); this.tone(dst, t, 'sine', 72, 28, 0.9, 0.9); this.noise(dst, t, 0.16, 'bandpass', 2600, 0.8, 0.5); break;
      case 'veh_charge': this.tone(dst, t, 'sawtooth', 200, 1600, 1.1, 0.1, 0.05); break;
      case 'sentinel_hurt': case 'sentinel_death': for (const f of [310, 740, 1180]) this.tone(dst, t, 'sine', f, f * 0.95, 0.5, 0.1); break;
      // ---- the End
      case 'dragon_roar': { this.voice(dst, t, 95 * (0.9 + r() * 0.2), 52, 2.4, 0.55, 420, [6, 9]); this.voice(dst, t + 0.05, 190, 90, 2.0, 0.25, 900, [7, 14]); const s = this.noise(dst, t, 2.2, 'bandpass', 700, 0.6, 0.45, 0.25, true); s.frequency.exponentialRampToValueAtTime(260, t + 2.1); break; }
      case 'dragon_growl': this.voice(dst, t, 62 * (0.9 + r() * 0.2), 48, 1.6, 0.45, 300, [4, 6]); this.noise(dst, t, 1.4, 'lowpass', 380, 1, 0.3, 0.3, true); break;
      case 'dragon_flap': { const s = this.noise(dst, t, 0.55, 'lowpass', 520, 0.8, 0.9, 0.12, true); s.frequency.exponentialRampToValueAtTime(140, t + 0.5); this.tone(dst, t + 0.05, 'sine', 70, 38, 0.4, 0.3, 0.08); break; }
      case 'dragon_hurt': this.voice(dst, t, 170 * (0.9 + r() * 0.2), 80, 0.9, 0.5, 700, [10, 18]); this.noise(dst, t, 0.4, 'bandpass', 1200, 1, 0.3, 0.02); break;
      case 'dragon_death': { this.voice(dst, t, 130, 30, 6.5, 0.55, 500, [3, 12]); this.voice(dst, t, 260, 60, 6, 0.25, 1100, [5, 20]); const s = this.noise(dst, t, 7, 'bandpass', 900, 0.5, 0.5, 1.5, true); s.frequency.exponentialRampToValueAtTime(120, t + 6.5); break; }
      case 'dragon_shoot': { const s = this.noise(dst, t, 0.9, 'lowpass', 2200, 0.8, 0.6, 0.01, true); s.frequency.exponentialRampToValueAtTime(250, t + 0.8); this.voice(dst, t, 150, 90, 0.6, 0.3, 600, [9, 15]); break; }
      case 'dragon_breath': { const s = this.noise(dst, t, 2.2, 'bandpass', 900, 0.5, 0.45, 0.1); s.frequency.exponentialRampToValueAtTime(400, t + 2); this.tone(dst, t, 'sine', 180, 120, 1.5, 0.12, 0.2); break; }
      case 'eye_launch': this.tone(dst, t, 'sine', 400, 1300, 0.45, 0.18); this.noise(dst, t, 0.35, 'bandpass', 2400, 2, 0.15, 0.05); break;
      case 'eye_death': for (let i = 0; i < 6; i++) this.tone(dst, t + i * 0.03, 'triangle', 2400 + r() * 1800, 900, 0.18, 0.1); this.noise(dst, t, 0.3, 'highpass', 4000, 1, 0.3); break;
      case 'eye_place': this.tone(dst, t, 'sine', 660, 990, 0.3, 0.2); this.tone(dst, t + 0.06, 'triangle', 1320, 1320, 0.4, 0.08); this.noise(dst, t, 0.12, 'lowpass', 900, 1, 0.3); break;
      case 'end_portal_open': [196, 247, 294, 392, 494, 587].forEach((f, i) => { this.tone(dst, t + i * 0.12, 'sawtooth', f, f * 1.005, 3.2 - i * 0.2, 0.05, 0.3); this.tone(dst, t + i * 0.12, 'sine', f * 2, f * 2, 3, 0.05, 0.3); }); this.noise(dst, t, 3.5, 'bandpass', 500, 2, 0.2, 1); break;
      case 'end_travel': { this.voice(dst, t, 55, 300, 2.8, 0.2, 600, [2, 14]); const s = this.noise(dst, t, 3, 'bandpass', 300, 1.5, 0.45, 0.6); s.frequency.exponentialRampToValueAtTime(2400, t + 2.8); break; }
      case 'gateway': { for (const f of [880, 1320, 1760]) this.tone(dst, t, 'sine', f, f * 0.5, 1.2, 0.08, 0.02); const s = this.noise(dst, t, 1, 'bandpass', 2600, 3, 0.25, 0.01); s.frequency.exponentialRampToValueAtTime(500, t + 0.9); break; }
      case 'firework_launch': { const s = this.noise(dst, t, 0.9, 'bandpass', 900, 1, 0.3, 0.02); s.frequency.exponentialRampToValueAtTime(3500, t + 0.8); break; }
      case 'firework_blast': { this.noise(dst, t, 1.4, 'lowpass', 1200, 0.7, 0.9, 0.003, true); this.tone(dst, t, 'sine', 110, 40, 0.6, 0.4); for (let i = 0; i < 10; i++) this.noise(dst, t + 0.35 + r() * 0.9, 0.04, 'highpass', 5000, 1, 0.2); break; }
      case 'teleport': { const s = this.noise(dst, t, 0.5, 'bandpass', 1500, 3, 0.35, 0.01); s.frequency.exponentialRampToValueAtTime(300, t + 0.45); this.tone(dst, t, 'sine', 1100, 250, 0.4, 0.15); break; }
      case 'enderman': this.voice(dst, t, 90 * (0.8 + r() * 0.5), 70 + r() * 80, 0.9, 0.2, 500, [18, 30]); this.noise(dst, t, 0.7, 'bandpass', 1400, 4, 0.08, 0.2); break;
      case 'enderman_stare': { this.voice(dst, t, 60, 240, 1.6, 0.35, 700, [25, 50]); const s = this.noise(dst, t, 1.6, 'bandpass', 400, 3, 0.35, 0.3); s.frequency.exponentialRampToValueAtTime(3000, t + 1.5); break; }
      case 'enderman_hurt': this.voice(dst, t, 200, 90, 0.4, 0.35, 900, [30, 60]); break;
      case 'enderman_death': this.voice(dst, t, 170, 40, 1.3, 0.35, 800, [20, 50]); this.noise(dst, t, 1, 'bandpass', 1500, 3, 0.2, 0.2); break;
      case 'mech_step': this.noise(dst, t, 0.45, 'lowpass', 260, 1, 0.9, 0.004, true); this.tone(dst, t, 'sine', 62, 34, 0.35, 0.55); this.tone(dst, t + 0.02, 'square', 170 * (0.9 + r() * 0.2), 120, 0.12, 0.05); this.noise(dst, t + 0.05, 0.25, 'bandpass', 1700, 3, 0.08, 0.05); break;
      case 'mech_stomp': this.noise(dst, t, 1.3, 'lowpass', 480, 0.7, 1.0, 0.003, true); this.tone(dst, t, 'sine', 70, 26, 0.9, 0.9); this.noise(dst, t, 0.2, 'bandpass', 900, 1, 0.5); break;
      case 'torpedo': { const s = this.noise(dst, t, 1.2, 'lowpass', 700, 1, 0.6, 0.02, true); s.frequency.exponentialRampToValueAtTime(260, t + 1.1); this.tone(dst, t, 'sine', 140, 70, 0.5, 0.35); for (let i = 0; i < 6; i++) this.tone(dst, t + 0.05 + i * 0.07, 'sine', 900 + r() * 700, 500, 0.06, 0.05); break; }
      case 'sonar': { this.tone(dst, t, 'sine', 1480, 1470, 1.4, 0.16, 0.01); this.tone(dst, t + 0.25, 'sine', 1480, 1470, 1.0, 0.05, 0.01); break; }
      case 'glide_boost': { const s = this.noise(dst, t, 1.2, 'bandpass', 700, 0.8, 0.45, 0.02); s.frequency.exponentialRampToValueAtTime(1800, t + 0.4); break; }
    }
  }
  // ---------------------------------------------------------------- continuous loops (engines, lasers, lock tone)
  panFor(x, y, z) {
    const p = this.game.player, cam = this.game.camera;
    if (!p || x === undefined) return [1, 0];
    const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z, d = Math.hypot(dx, dy, dz);
    return [Math.max(0, 1 - d / 70), clamp((dx * Math.cos(cam.yaw) + dz * Math.sin(cam.yaw)) / Math.max(d, 1), -0.8, 0.8)];
  }
  loopNode(build) {
    const ctx = this.ctx, g = ctx.createGain(); g.gain.value = 0;
    let dst = g;
    if (ctx.createStereoPanner) { const pan = ctx.createStereoPanner(); g.connect(pan); pan.connect(this.sfx); dst = pan; } else g.connect(this.sfx);
    const n = { g, pan: dst !== g ? dst : null, src: [], target: 0, cur: 0, seen: performance.now(), x: undefined, y: 0, z: 0 };
    build(n, g);
    return n;
  }
  osc(n, type, f, dst) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(dst); o.start(); n.src.push(o); return o; }
  noiseSrc(n, brown, dst) { const s = this.ctx.createBufferSource(); s.buffer = brown ? this.brownBuf : this.noiseBuf; s.loop = true; s.connect(dst); s.start(0, Math.random() * 1.5); n.src.push(s); return s; }
  filt(type, f, q, dst) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q || 1; b.connect(dst); return b; }
  gainN(v, dst) { const g = this.ctx.createGain(); g.gain.value = v; g.connect(dst); return g; }
  loop(name, key, vol, x, y, z) {
    if (!this.ok) return;
    const L = this.loops || (this.loops = new Map());
    const k = name + ':' + (key.id || (key.__lid || (key.__lid = Math.floor(Math.random() * 1e9))));
    let n = L.get(k);
    if (vol <= 0) { if (n) n.target = 0; return; }
    if (!n) {
      n = this.loopNode((n, g) => {
        if (name === 'drill') { const f = this.filt('bandpass', 900, 1.2, g); this.noiseSrc(n, false, this.gainN(0.8, f)); const lp = this.filt('lowpass', 420, 1, g); this.osc(n, 'sawtooth', 46, this.gainN(0.35, lp)); const q = this.osc(n, 'square', 23, this.gainN(0.25, lp)); void q; const lfo = this.osc(n, 'sine', 9, this.gainN(300, f.frequency)); void lfo; }
        else if (name === 'laser') { const f = this.filt('bandpass', 1400, 2.5, g); this.osc(n, 'sawtooth', 118, f); this.osc(n, 'square', 237, f); const lfo = this.osc(n, 'sine', 13, this.gainN(500, f.frequency)); void lfo; this.noiseSrc(n, false, this.gainN(0.25, this.filt('highpass', 3000, 0.7, g))); }
        else { this.osc(n, 'square', 1250, this.gainN(0.5, g)); }
      });
      L.set(k, n);
    }
    n.target = vol; n.seen = performance.now(); n.x = x; n.y = y; n.z = z;
  }
  engine(v, spec) {
    if (!this.ok || !spec) return;
    const E = this.engines || (this.engines = new Map());
    let n = E.get(v.id);
    if (!n) {
      n = this.loopNode((n, g) => {
        if (spec.kind === 'jet') {
          n.lp = this.filt('lowpass', 400, 0.7, g); this.noiseSrc(n, true, this.gainN(1.4, n.lp));
          n.whineF = this.filt('bandpass', 2000, 5, g); n.whineG = this.gainN(0.25, n.whineF); this.noiseSrc(n, false, n.whineG);
          n.hum = this.osc(n, 'sawtooth', 80, this.gainN(0.12, this.filt('lowpass', 500, 1, g)));
          n.abG = this.gainN(0, this.filt('lowpass', 180, 0.8, g)); this.noiseSrc(n, true, n.abG);
        } else if (spec.kind === 'gunship') {
          n.turb = this.osc(n, 'triangle', 320, this.gainN(0.08, g));
          const lp = this.filt('lowpass', 650, 0.9, g); n.chopG = this.gainN(0.6, lp); this.noiseSrc(n, true, n.chopG);
          n.chop = this.osc(n, 'sine', 11, this.gainN(0.45, n.chopG.gain));
        } else if (spec.kind === 'sub') {
          n.lp = this.filt('lowpass', 300, 1.2, g); this.noiseSrc(n, true, this.gainN(1.1, n.lp));
          n.hum = this.osc(n, 'sine', 55, this.gainN(0.22, g)); n.whirF = this.filt('bandpass', 220, 4, g); n.whirG = this.gainN(0.3, n.whirF); this.noiseSrc(n, false, n.whirG);
        } else if (spec.kind === 'mech') {
          n.lp = this.filt('lowpass', 380, 1.5, g);
          n.o1 = this.osc(n, 'sawtooth', 38, this.gainN(0.22, n.lp)); n.o2 = this.osc(n, 'sawtooth', 38.6, this.gainN(0.18, n.lp));
          n.whineF = this.filt('bandpass', 900, 8, g); this.noiseSrc(n, false, this.gainN(0.1, n.whineF));
          n.jetG = this.gainN(0, this.filt('bandpass', 700, 0.6, g)); this.noiseSrc(n, false, n.jetG);
        } else {
          n.lp = this.filt('lowpass', 500, 2, g);
          n.o1 = this.osc(n, 'sawtooth', 60, this.gainN(0.2, n.lp)); n.o2 = this.osc(n, 'sawtooth', 60.7, this.gainN(0.2, n.lp));
          n.whineF = this.filt('bandpass', 1200, 6, g); this.noiseSrc(n, false, this.gainN(0.15, n.whineF));
        }
      });
      n.kind = spec.kind; E.set(v.id, n);
    }
    const c = v.center ? v.center([0, 0, 0]) : [v.x, v.y, v.z];
    n.x = c[0]; n.y = c[1]; n.z = c[2]; n.seen = performance.now();
    const thr = spec.thr, now = this.ctx.currentTime, set = (prm, val) => prm.setTargetAtTime(val, now, 0.08);
    if (spec.kind === 'jet') {
      n.target = 0.05 + thr * 0.55 + spec.ab * 0.25;
      set(n.lp.frequency, 250 + thr * 1400 + spec.ab * 600); set(n.whineF.frequency, 1400 + thr * 3200 + spec.speed * 6); set(n.whineG.gain, 0.08 + thr * 0.3);
      set(n.hum.frequency, 60 + thr * 110); set(n.abG.gain, spec.ab * 1.6);
      if (v.removed || (!v.rider && thr < 0.01 && v.engine < 0.03)) n.target = 0;
    } else if (spec.kind === 'gunship') {
      n.target = Math.min(0.7, thr * 0.7 + spec.boost * 0.15);
      set(n.turb.frequency, 260 + thr * 260 + spec.speed * 3); set(n.chop.frequency, 6 + thr * 9);
    } else if (spec.kind === 'sub') {
      n.target = v.rider ? 0.18 + thr * 0.4 : 0;
      set(n.lp.frequency, 160 + thr * 500 + spec.boost * 200); set(n.hum.frequency, 42 + thr * 40); set(n.whirF.frequency, 160 + thr * 520); set(n.whirG.gain, 0.08 + thr * 0.35);
    } else if (spec.kind === 'mech') {
      n.target = v.rider ? 0.25 + thr * 0.3 + spec.boost * 0.3 : 0;
      set(n.lp.frequency, 260 + spec.speed * 30); set(n.o1.frequency, 34 + spec.speed * 2); set(n.o2.frequency, 34.6 + spec.speed * 2); set(n.whineF.frequency, 700 + spec.speed * 70); set(n.jetG.gain, spec.boost * 1.2);
    } else {
      n.target = v.rider ? 0.3 + thr * 0.35 : 0;
      if (spec.kind === 'tank' || spec.kind === 'drill') { set(n.lp.frequency, 220 + spec.speed * 18 + spec.boost * 300); set(n.o1.frequency, 30 + spec.speed * 1.6 + spec.boost * 10); set(n.o2.frequency, 30.5 + spec.speed * 1.6 + spec.boost * 10); set(n.whineF.frequency, 600 + spec.speed * 30); return; }
      set(n.lp.frequency, 380 + spec.speed * 26 + spec.boost * 800); set(n.o1.frequency, 48 + spec.speed * 2.2 + spec.boost * 30); set(n.o2.frequency, 48.6 + spec.speed * 2.2 + spec.boost * 30); set(n.whineF.frequency, 900 + spec.speed * 45);
    }
    if (v.removed) n.target = 0;
  }
  updateLoops(dt) {
    const tnow = performance.now();
    for (const M of [this.loops, this.engines]) {
      if (!M) continue;
      for (const [k, n] of M) {
        if (tnow - n.seen > 150) n.target = 0;
        const [att, pan] = this.panFor(n.x, n.y, n.z);
        n.cur += (n.target * att - n.cur) * Math.min(1, dt * 10);
        n.g.gain.value = n.cur;
        if (n.pan) n.pan.pan.value = pan;
        if (n.target === 0 && n.cur < 0.002) { for (const s of n.src) { try { s.stop(); } catch (e) { } } n.g.disconnect(); M.delete(k); }
      }
    }
  }
  // ---------------------------------------------------------------- music & ambience
  update(dt) {
    if (!this.ok) return;
    const g = this.game;
    this.applyVolumes();
    this.updateLoops(dt);
    // cave reverb
    const p = g.player;
    if (p && g.world) {
      const sky = p.eyeSky || 0;
      const target = g.world.dim === 'nether' ? 0.5 : (sky < 4 ? 0.7 : 0.05);
      this.caveSend.gain.value += (target - this.caveSend.gain.value) * 0.05;
    }
    // rain ambience
    const rain = (g.rainLevel || 0) * (g.world && g.world.dim === 'overworld' ? 1 : 0);
    if (!this.rainNode && rain > 0.05) {
      const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.4;
      const gg = this.ctx.createGain(); gg.gain.value = 0; s.connect(f); f.connect(gg); gg.connect(this.amb); s.start();
      this.rainNode = { s, g: gg };
    }
    if (this.rainNode) {
      const exposed = p && g.world.canSeeSky(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)) ? 1 : 0.35;
      this.rainNode.g.gain.value += (rain * 0.12 * exposed - this.rainNode.g.gain.value) * 0.05;
      if (rain <= 0.01 && this.rainNode.g.gain.value < 0.002) { this.rainNode.s.stop(); this.rainNode = null; }
    }
    // cave / nether ambience
    this.ambT -= dt;
    if (this.ambT <= 0 && p) {
      this.ambT = 20 + Math.random() * 60;
      if (g.world.dim === 'nether') this.netherAmbient();
      else if (g.world.dim === 'end') { this.endAmbient(); this.ambT = 12 + Math.random() * 25; }
      else if (p.eyeSky < 3 && p.y < 55) this.caveAmbient();
    }
    // wind rushing past while gliding with an elytra
    const glide = p && p.gliding ? clamp(Math.hypot(p.vx, p.vy, p.vz) / 2.2, 0.08, 1) : 0;
    if (glide > 0 && !this.windNode) {
      const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 0.6;
      const gg = this.ctx.createGain(); gg.gain.value = 0; s.connect(f); f.connect(gg); gg.connect(this.sfx); s.start();
      this.windNode = { s, f, g: gg };
    }
    if (this.windNode) {
      const W = this.windNode;
      W.g.gain.value += (glide * 0.35 - W.g.gain.value) * Math.min(1, dt * 4);
      W.f.frequency.value = 400 + glide * 1600;
      if (!glide && W.g.gain.value < 0.003) { W.s.stop(); W.g.disconnect(); this.windNode = null; }
    }
    // music (the dragon fight gets its own, more urgent cue)
    if (SETTINGS.musicVol > 0 && g.state === 'playing') {
      this.musicT -= dt;
      const boss = g.endFight && g.endFight.active;
      if (boss && !this.playingMusic && this.musicT > 4) this.musicT = 4;
      if (this.musicT <= 0 && !this.playingMusic) { this.playMusic(g.world.dim === 'nether' ? 'nether' : g.world.dim === 'end' ? (boss ? 'boss' : 'end') : false); }
    }
    if (g.state === 'menu' && SETTINGS.musicVol > 0 && !this.playingMusic) { this.musicT -= dt; if (this.musicT <= 0) this.playMusic(false); }
  }
  caveAmbient() {
    const t = this.ctx.currentTime, dst = this.ctx.createGain(); dst.gain.value = 0.15; dst.connect(this.amb); dst.connect(this.verb);
    const f = [55, 65, 73, 82][Math.floor(Math.random() * 4)];
    this.voice(dst, t, f, f * (Math.random() < 0.5 ? 0.8 : 1.25), 4, 0.4, 300, [0.3, 3]);
    this.noise(dst, t, 3, 'bandpass', 250, 4, 0.2, 1.2, true);
  }
  netherAmbient() {
    const t = this.ctx.currentTime, dst = this.ctx.createGain(); dst.gain.value = 0.18; dst.connect(this.amb); dst.connect(this.verb);
    this.voice(dst, t, 45, 40, 6, 0.4, 200, [0.2, 2]);
    this.noise(dst, t, 5, 'lowpass', 300, 1, 0.3, 2, true);
  }
  endAmbient() {
    // hollow wind over the void and distant, unplaceable chimes
    const t = this.ctx.currentTime, dst = this.ctx.createGain(); dst.gain.value = 0.16; dst.connect(this.amb); dst.connect(this.verb);
    const s = this.noise(dst, t, 7, 'bandpass', 300 + Math.random() * 200, 3, 0.35, 2.5, true); s.frequency.exponentialRampToValueAtTime(180 + Math.random() * 400, t + 6.5);
    if (Math.random() < 0.6) { const f = [880, 988, 1175, 1319, 1480][Math.floor(Math.random() * 5)]; this.tone(dst, t + 1 + Math.random() * 3, 'sine', f, f * 0.998, 3.5, 0.05, 0.02); this.tone(dst, t + 1.6 + Math.random() * 3, 'sine', f * 1.5, f * 1.5, 3, 0.03, 0.02); }
  }
  playMusic(mode) {
    const ctx = this.ctx; this.playingMusic = true;
    const nether = mode === true || mode === 'nether', end = mode === 'end', boss = mode === 'boss';
    const scales = boss ? [[0, 2, 3, 5, 7, 8, 11]] : end ? [[0, 2, 4, 6, 7, 9, 11], [0, 2, 4, 6, 8, 10]] : nether ? [[0, 1, 3, 5, 7, 8, 10]] : [[0, 2, 4, 7, 9], [0, 2, 3, 7, 8], [0, 2, 4, 5, 7, 9, 11], [0, 3, 5, 7, 10]];
    const scale = scales[Math.floor(Math.random() * scales.length)];
    const root = boss ? 45 + Math.floor(Math.random() * 3) : end ? 54 + Math.floor(Math.random() * 5) : nether ? 41 + Math.floor(Math.random() * 4) : 50 + Math.floor(Math.random() * 7);
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const dst = ctx.createGain(); dst.gain.value = 0.9; dst.connect(this.music);
    const wet = ctx.createGain(); wet.gain.value = end ? 1.4 : 0.9; dst.connect(wet); wet.connect(this.verb);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = nether ? 900 : boss ? 1800 : 2600; lp.connect(dst);
    let t = ctx.currentTime + 0.5;
    const bars = boss ? 16 : 10 + Math.floor(Math.random() * 10), beat = boss ? 0.42 : end ? 1.05 : nether ? 0.9 : 0.6 + Math.random() * 0.25;
    if (boss) {
      // a driving low ostinato under the melody for the dragon fight
      for (let b = 0; b < bars; b++) for (let s = 0; s < 8; s++) {
        const m = root - 24 + (s === 6 ? scale[4] : s === 7 ? scale[2] : 0) + (b % 4 === 3 ? scale[5] - 12 : 0), f = mtof(m), time = t + b * beat * 4 + s * beat / 2;
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        const bl = ctx.createBiquadFilter(); bl.type = 'lowpass'; bl.frequency.value = 420;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, time); g.gain.exponentialRampToValueAtTime(s % 2 ? 0.05 : 0.08, time + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, time + beat * 0.45);
        o.connect(bl); bl.connect(g); g.connect(dst); o.start(time); o.stop(time + beat * 0.5);
        if (s === 0 || s === 4) { const k = ctx.createOscillator(); k.type = 'sine'; k.frequency.setValueAtTime(110, time); k.frequency.exponentialRampToValueAtTime(40, time + 0.18); const kg = ctx.createGain(); kg.gain.setValueAtTime(0.25, time); kg.gain.exponentialRampToValueAtTime(0.0001, time + 0.25); k.connect(kg); kg.connect(dst); k.start(time); k.stop(time + 0.3); }
      }
    }
    const piano = (time, m, vel, len) => {
      const f = mtof(m);
      for (const [mul, a, dec] of [[1, 1, len], [2, 0.35, len * 0.5], [3, 0.12, len * 0.3], [4.01, 0.05, len * 0.2]]) {
        const o = ctx.createOscillator(); o.type = mul === 1 ? 'triangle' : 'sine'; o.frequency.value = f * mul * (1 + (Math.random() - 0.5) * 0.001);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, time); g.gain.exponentialRampToValueAtTime(vel * a * 0.18, time + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, time + dec);
        o.connect(g); g.connect(lp); o.start(time); o.stop(time + dec + 0.1);
      }
    };
    const pad = (time, ms, len) => {
      for (const m of ms) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, time); g.gain.exponentialRampToValueAtTime(0.03, time + len * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, time + len); o.connect(g); g.connect(lp); o.start(time); o.stop(time + len + 0.1); }
    };
    let deg = Math.floor(Math.random() * scale.length);
    const note = (d) => root + 12 * Math.floor(d / scale.length) + scale[((d % scale.length) + scale.length) % scale.length];
    for (let b = 0; b < bars; b++) {
      const chordD = [0, 3, 4, 2, 5][Math.floor(Math.random() * 5)];
      pad(t, [note(chordD) - 12, note(chordD + 2) - 12, note(chordD + 4) - 12], beat * 4.5);
      if (Math.random() < 0.8) piano(t, note(chordD) - 12, 0.6, beat * 4);
      for (let s = 0; s < 4; s++) {
        if (Math.random() < (nether ? 0.35 : 0.55)) { deg += Math.floor(Math.random() * 5) - 2; deg = clamp(deg, -2, scale.length * 2); piano(t + s * beat + (Math.random() - 0.5) * 0.04, note(deg), 0.4 + Math.random() * 0.5, beat * 3); if (Math.random() < 0.2) piano(t + s * beat + beat / 2, note(deg + 2), 0.3, beat * 2); }
      }
      t += beat * 4;
    }
    const total = t - ctx.currentTime;
    setTimeout(() => { this.playingMusic = false; this.musicT = 120 + Math.random() * 240; }, total * 1000 + 3000);
  }
}
