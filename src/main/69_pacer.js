// ============================================================================
//  Frame pacing: VSync, a frame cap, or Unlimited
//
//  requestAnimationFrame is tied to the display refresh, so a loop driven by it never renders faster than the
//  monitor. How Unlimited (and caps above the refresh rate) get past that:
//  - Desktop launcher: Chromium runs with --disable-frame-rate-limit (LAUNCH.uncapped), requestAnimationFrame
//    fires back to back and every frame it renders is presented.
//  - A normal browser tab still shows one frame per refresh. The presented frame is rendered from
//    requestAnimationFrame, and extra frames run from a MessageChannel loop until just before the next refresh.
//    Handing control back in time matters: a page that never yields gets to present only every 100 ms or so.
//    A fence keeps those extra frames at most two ahead of the GPU, so the presented one is never queued
//    behind a backlog.
//  The GPU queue (SETTINGS.gpuQueue) limits frames in flight the same way in the launcher. Uncapped frames that
//  pile up on the GPU make every buffer upload wait for the backlog: on OpenGL a still scene averaged 2000 fps that
//  looked like 20, and on Direct3D 11 flying over new terrain stalled 87 times a minute. Three in flight (Auto)
//  removed the stalls on every backend, for some peak fps on a still scene.
//  Every path below schedules exactly one next wake-up (animation frame, message or timer).
// ============================================================================
class FramePacer {
  constructor(game) {
    this.g = game;
    this.uncapped = !!LAUNCH.uncapped;
    this.hz = LAUNCH.hz || 60;            // display refresh rate (measured from animation frames in a normal tab)
    this.limit = 0;                       // limit applied to the latest frame: -1 VSync, 0 none, n fps
    this.lastFrame = 0; this.lastRaf = 0; this.nextVsync = 0; this.idleFrom = 0; this.workMs = 1; this.due = 0; this.calT = 0; this.q = 0;
    this.rafD = []; this.fences = []; this.fenceT = [];
    this.rafPending = this.msgPending = this.timerPending = false;
    this.onRaf = (t) => { this.rafPending = false; this.vsync(t); this.tick(true); };
    this.onTimer = () => { this.timerPending = false; this.tick(false); };
    if (typeof MessageChannel !== 'undefined') { this.mc = new MessageChannel(); this.mc.port1.onmessage = () => { this.msgPending = false; this.tick(false); }; }
    // statistics over half-second windows
    this.win = { t: now(), n: 0, shown: 0, sum: 0, max: 0 };
    this.fps = 0; this.shownHz = 0; this.avgMs = 0; this.maxMs = 0;
  }
  start() { this.lastFrame = now(); this.raf(); }
  raf() { if (!this.rafPending) { this.rafPending = true; requestAnimationFrame(this.onRaf); } }
  post() { if (!this.mc) { this.timer(0); return; } if (!this.msgPending) { this.msgPending = true; this.mc.port2.postMessage(0); } }
  timer(ms) { if (!this.timerPending) { this.timerPending = true; setTimeout(this.onTimer, Math.max(0, ms)); } }
  // frames allowed on the GPU at once before the next one starts (0: the browser's own queueing)
  queue(hybrid) {
    const q = Math.round(+SETTINGS.gpuQueue || 0);
    if (q > 0) return q;
    if (q < 0) return 0;
    if (hybrid) return 2;
    return this.uncapped ? 3 : 0;
  }
  // -1 = VSync, 0 = no limit, n = frame cap
  currentLimit() {
    const st = this.g.state, S = SETTINGS;
    if (S.menuVsync !== false && (st === 'menu' || st === 'paused' || st === 'loading' || st === 'dead')) return -1;
    const c = +S.fpsCap || 0;
    return c < 0 ? -1 : c > 0 ? Math.max(5, c) : 0;
  }
  tick(fromRaf) {
    const t = now();
    if (document.hidden) { this.raf(); return; }
    let lim = this.currentLimit();
    // animation frames are not tied to the display here, so VSync becomes a cap at its refresh rate
    if (this.uncapped && lim < 0) lim = Math.round(this.hz);
    this.limit = lim;
    if (this.uncapped) {
      this.q = this.queue(false);
      // the queue is full: check again on the next animation frame (they come back to back here)
      if (this.q && !this.fenceFree(this.q)) { this.raf(); return; }
      if (fromRaf && (lim <= 0 || t >= this.due - 0.3)) { this.advance(lim, t); this.frame(t, true); }
      const wait = lim > 0 ? this.due - now() : 0;
      if (wait > 1.5) { this.idleFrom = this.idleFrom || now(); this.timer(wait - 1); } else this.raf();
      return;
    }
    if (lim < 0 || (lim > 0 && lim <= this.hz * 1.1)) {
      // VSync, or a cap the display can show: render on animation frames, skipping some to stay under the cap
      this.q = 0;
      if (fromRaf && (lim <= 0 || t >= this.due - 2)) { this.advance(lim, t); this.frame(t, true); }
      this.raf();
      return;
    }
    // Unlimited, or a cap above the refresh rate, in a normal tab
    this.q = this.queue(true);
    if (fromRaf) {
      this.advance(lim, t); this.frame(t, true);
      // once a second one refresh gets no extra frames, so the next interval measures the display honestly
      if (t - this.calT > 1000) { this.calT = t; this.raf(); } else this.post();
      return;
    }
    const margin = this.workMs * 1.5 + 1;
    if (t + margin >= this.nextVsync) { this.idleFrom = this.idleFrom || t; this.raf(); return; }
    if (lim > 0) {
      const wait = this.due - t;
      if (wait > 0) {
        this.idleFrom = this.idleFrom || t;
        // never sleep past the point where the browser must get its turn (timers can fire a millisecond late)
        const room = this.nextVsync - margin - t;
        if (wait > 3 && room > 3) this.timer(Math.min(wait, room) - 2); else this.post();
        return;
      }
    }
    if (this.q && !this.fenceFree(this.q)) { this.post(); return; }
    this.advance(lim, t);
    this.frame(t, false);
    this.post();
  }
  // with a cap the next frame is due one interval after the previous due time (not after the previous frame), so
  // timer and refresh jitter average out; after a stall it catches up by at most half an interval
  advance(lim, t) { this.due = lim > 0 ? Math.max(this.due + 1000 / lim, t - 500 / lim) : t; }
  frame(t, shown) {
    const interval = t - this.lastFrame, idle = this.idleFrom && this.idleFrom < t ? t - this.idleFrom : 0;
    this.lastFrame = t; this.idleFrom = 0;
    this.g.runFrame(interval, Math.max(0.01, interval - idle));
    const work = now() - t;
    this.workMs += (work - this.workMs) * 0.15;
    if (this.q) this.fence();
    if (this.rec) this.rec.push(interval);
    const W = this.win;
    W.n++; if (shown) W.shown++; W.sum += interval; if (interval > W.max) W.max = interval;
    if (t - W.t >= 500) {
      const s = (t - W.t) / 1000;
      this.fps = W.n / s; this.shownHz = W.shown / s; this.avgMs = W.sum / W.n; this.maxMs = W.max;
      W.t = t; W.n = W.shown = 0; W.sum = W.max = 0;
    }
  }
  // animation frame timestamps give the display's refresh interval (normal tab) and when the next refresh is due.
  // A starved animation frame only ever comes late, so the shortest recent interval is the display's: a longer
  // estimate would make the extra frames run longer and starve the browser further.
  vsync(t) {
    if (!this.uncapped && this.lastRaf) {
      const d = t - this.lastRaf, D = this.rafD;
      if (d > 1.5 && d < 100) { D.push(d); if (D.length > 60) D.shift(); }
      if (D.length >= 4) {
        let m = Infinity; for (let i = 0; i < D.length; i++) if (D[i] < m) m = D[i];
        let s = 0, n = 0; for (let i = 0; i < D.length; i++) if (D[i] < m * 1.08) { s += D[i]; n++; }
        this.hz = clamp(n * 1000 / s, 20, 500);
      }
    }
    this.lastRaf = t;
    this.nextVsync = t + 1000 / this.hz;
  }
  // GPU fences: frames the GPU has not finished yet (WebGL only updates their status between tasks)
  fenceFree(limit) {
    const gl = GLX.gl, F = this.fences, T = this.fenceT;
    while (F.length && gl.getSyncParameter(F[0], gl.SYNC_STATUS) === gl.SIGNALED) { gl.deleteSync(F.shift()); T.shift(); }
    // a fence that never signals (lost context) must not stall the loop
    if (F.length && now() - T[0] > 250) { for (const s of F) gl.deleteSync(s); F.length = 0; T.length = 0; }
    return F.length < (limit || 2);
  }
  fence() {
    const gl = GLX.gl; if (!gl || !gl.fenceSync) return;
    this.fenceFree();
    const s = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (s) { this.fences.push(s); this.fenceT.push(now()); gl.flush(); }
  }
  // frame time Auto Quality aims for: its target rate, but never above the cap or (with VSync) the display
  budgetMs() {
    let fps = +SETTINGS.aqTarget || 60;
    const lim = this.limit;
    if (lim < 0) fps = Math.min(fps, this.hz); else if (lim > 0) fps = Math.min(fps, lim);
    return 1000 / Math.max(10, fps);
  }
  describe() {
    const lim = this.limit, mode = lim < 0 ? 'VSync' : lim > 0 ? 'cap ' + lim : 'unlimited';
    let how;
    if (this.uncapped) how = 'every frame presented (launcher)';
    else if (lim < 0 || (lim > 0 && lim <= this.hz * 1.1)) how = 'on display refreshes';
    else how = `${(this.fps / Math.max(1, this.shownHz)).toFixed(1)} frames per refresh, the browser shows ${Math.round(this.shownHz)}/s`;
    return `Pacing: ${mode}, ${how}, ${this.q ? 'GPU queue ' + this.q + ', ' : ''}display ${Math.round(this.hz)} Hz, frame ${this.avgMs.toFixed(2)} ms (max ${this.maxMs.toFixed(1)})`;
  }
  // frame intervals between record() and stats(): the average rate, and the steady rate (the frame time the screen is
  // at or below 90% of the time, so a few long stalls count by how long they last, not by how few they are)
  record() { this.rec = []; }
  stats() { const iv = this.rec || []; this.rec = null; return FramePacer.statsOf(iv); }
  static statsOf(iv) {
    if (!iv.length) return { fps: 0, steadyFps: 0, hitches: 0 };
    let total = 0; for (const d of iv) total += d;
    const s = iv.slice().sort((a, b) => b - a);
    let acc = 0, tw = s[s.length - 1];
    for (const d of s) { acc += d; if (acc >= total * 0.1) { tw = d; break; } }
    return { fps: iv.length * 1000 / total, steadyFps: 1000 / Math.max(tw, 0.01), hitches: iv.filter(d => d > 50).length, p99Ms: s[Math.floor(s.length * 0.01)] };
  }
}
