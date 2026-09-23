// ============================================================================
//  Adaptive quality governor
//
//  Keeps the frame rate smooth on any machine. It watches GPU time (timer queries when the browser
//  exposes them, otherwise the frame interval) and walks a ladder of steps: first the internal render
//  resolution (upscaled with sharpening), then individual effects, cheapest-to-lose first.
//  Fast machines stay on step 0 and render everything at native resolution.
// ============================================================================
const PERF_LADDER = [
  // [resolution scale, PERF_CAPS level]
  [1.0, 0], [0.9, 0], [0.8, 0], [0.8, 1], [0.8, 2], [0.72, 2], [0.72, 3], [0.72, 4],
  [0.64, 4], [0.64, 5], [0.64, 6], [0.56, 6], [0.56, 7], [0.5, 7], [0.5, 8],
];
class PerfGovernor {
  constructor(game) {
    this.g = game;
    let saved = 0; try { saved = +(localStorage.getItem('vc5_perf') || 0); } catch (e) { }
    this.idx = clamp(saved | 0, 0, PERF_LADDER.length - 1);
    if (GLX.software) this.idx = Math.max(this.idx, PERF_LADDER.length - 3);
    this.best = 0; this.bestUntil = 0;          // temporary quality ceiling after a failed step up
    this.blockUpUntil = now() + 4000; this.lastUp = -1e9; this.nextEval = now() + 1500;
    this.frames = []; this.cpu = []; this.over = 0; this.good = 0; this.probe = 10000;
    this.apply(this.idx, true);
  }
  get active() { return !!SETTINGS.autoQuality; }
  // called once per rendered frame with the frame interval and main-thread work time (ms)
  update(intervalMs, cpuMs) {
    const t = now();
    if (!this.active) { if (this.idx !== 0) this.apply(0); return; }
    if (this.g.state !== 'playing' && this.g.state !== 'menu') { this.nextEval = t + 1000; this.frames.length = 0; this.cpu.length = 0; return; }
    if (intervalMs > 0 && intervalMs < 1000) { this.frames.push(intervalMs); this.cpu.push(cpuMs); }
    if (t < this.nextEval || this.frames.length < 8) return;
    this.nextEval = t + 500;
    const fr = this.frames.slice().sort((a, b) => a - b), cp = this.cpu.slice().sort((a, b) => a - b);
    this.frames.length = 0; this.cpu.length = 0;
    const medFrame = fr[fr.length >> 1], p80 = fr[Math.floor(fr.length * 0.8)], medCpu = cp[cp.length >> 1];
    const budget = SETTINGS.fpsCap ? 1000 / SETTINGS.fpsCap : 1000 / 60;
    const tq = this.g.renderer.tq, gpuOk = tq && tq.valid && t - tq.stamp < 1500;
    const gpu = gpuOk ? tq.ms : 0;
    this.stat = { frame: medFrame, cpu: medCpu, gpu: gpuOk ? gpu : -1, budget };
    // overloaded: frames are slower than the budget and the GPU (or, without timers, the frame itself) is why.
    // With timers, two more signs count: a nearly saturated GPU while frames miss the budget, and a GPU right at the
    // limit that makes one frame in eight miss vsync (medians look fine, but that is visible stutter).
    let miss = 0; for (let i = 0; i < fr.length; i++) if (fr[i] > budget * 1.5) miss++;
    const slow = (p80 > budget * 1.18 && medFrame > budget * 1.08) || (gpuOk && gpu > budget * 0.92 && medFrame > budget * 1.02) || (gpuOk && miss > fr.length * 0.12);
    const gpuBound = gpuOk ? gpu > budget * 0.75 : medCpu < medFrame * 0.6;
    if (slow && gpuBound) {
      this.good = 0;
      if (++this.over >= 2 && this.idx < PERF_LADDER.length - 1) {
        const worst = gpuOk ? gpu / budget : medFrame / budget;
        const steps = worst > 2.2 ? 3 : worst > 1.5 ? 2 : 1;
        if (t - this.lastUp < 6000) { this.best = this.idx + 1; this.bestUntil = t + 90000; }
        this.apply(Math.min(PERF_LADDER.length - 1, this.idx + steps));
        this.over = 0; this.blockUpUntil = t + 6000;
      }
      return;
    }
    this.over = 0;
    if (this.idx === 0 || t < this.blockUpUntil) return;
    if (t > this.bestUntil) this.best = 0;
    if (this.idx - 1 < this.best) return;
    // headroom: with GPU timers we can see it directly; without them, probe upward now and then
    const roomy = gpuOk ? gpu < budget * 0.55 && medCpu < budget * 0.6 : medFrame <= budget * 1.04;
    if (!roomy) { this.good = 0; return; }
    // lots of headroom (e.g. after a brief spike on a fast GPU): climb back quickly, two steps at a time
    const wide = gpuOk && gpu < budget * 0.25;
    this.good += 500;
    if (this.good >= (!gpuOk ? this.probe : wide ? 1000 : 3000)) {
      this.good = 0; this.lastUp = t;
      if (!gpuOk) this.probe = Math.min(60000, this.probe * 1.5);
      this.apply(Math.max(this.best, this.idx - (wide && this.idx >= 2 ? 2 : 1)));
      this.blockUpUntil = t + 1500;
    }
  }
  apply(idx, init) {
    const [scale, level] = PERF_LADDER[idx];
    const R = this.g.renderer;
    const changedLevel = level !== PERF_LEVEL;
    this.idx = idx;
    PERF_LEVEL = level; refreshEff();
    R.autoScale = scale;
    if (!init) { R.width = 0; R.visDirty = true; }
    if (changedLevel && !init) { R.freePost(); R.post = null; }
    try { localStorage.setItem('vc5_perf', String(idx)); } catch (e) { }
  }
  describe() {
    const s = this.stat, [scale, level] = PERF_LADDER[this.idx];
    const g = s ? (s.gpu >= 0 ? ` gpu ${s.gpu.toFixed(1)} ms` : ' gpu n/a') + ` cpu ${s.cpu.toFixed(1)} ms` : '';
    return this.active ? `Auto quality: step ${this.idx}/${PERF_LADDER.length - 1} (render ${Math.round(scale * 100)}%, effects -${level})${g}` : 'Auto quality: off';
  }
}
