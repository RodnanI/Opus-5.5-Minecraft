// ============================================================================
//  Worker pool (blob workers built from inline script text) with fallback
// ============================================================================
class Jobs {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.workers = [];
    this.nextId = 1;
    this.cbs = new Map();
    const shared = document.getElementById('shared-src').textContent;
    const wsrc = document.getElementById('worker-src').textContent;
    const n = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
    let ok = false;
    try {
      const url = URL.createObjectURL(new Blob([shared, '\n', wsrc], { type: 'application/javascript' }));
      for (let i = 0; i < n; i++) {
        const w = new Worker(url);
        w.inflight = 0;
        w.onmessage = (e) => this.handle(w, e.data);
        w.onerror = (e) => console.error('Worker error', e.message || e);
        this.workers.push(w);
      }
      ok = true;
    } catch (e) { console.warn('Workers unavailable, using main thread fallback', e); }
    if (!ok) {
      // fallback: evaluate worker code with a fake self
      const fake = { inflight: 0, onmessage: null, postMessage: null, queue: [] };
      const selfObj = { postMessage: (msg) => { this.handle(fake, msg); } };
      const fn = new Function('self', wsrc + '\nreturn self.onmessage;');
      const handler = fn(selfObj);
      fake.postMessage = (msg) => { fake.queue.push(msg); };
      fake.pump = (budget) => { const t0 = now(); while (fake.queue.length && now() - t0 < budget) handler({ data: fake.queue.shift() }); };
      this.workers.push(fake);
      this.fallback = fake;
    }
    this.maxPer = this.fallback ? 1 : 3;
  }
  broadcast(msg) { for (const w of this.workers) w.postMessage(msg); }
  free() { let f = 0; for (const w of this.workers) f += Math.max(0, this.maxPer - w.inflight); return f; }
  post(msg, transfer, cb) {
    let best = null;
    for (const w of this.workers) if (!best || w.inflight < best.inflight) best = w;
    msg.id = this.nextId++;
    if (cb) this.cbs.set(msg.id, cb);
    best.inflight++;
    best.postMessage(msg, transfer || []);
    return msg.id;
  }
  handle(w, d) {
    if (d.t !== 'init') w.inflight = Math.max(0, w.inflight - 1);
    if (d.t === 'error') console.error('Worker job failed:', d.msg);
    const cb = this.cbs.get(d.id);
    if (cb) { this.cbs.delete(d.id); cb(d); }
    else this.onMessage(d);
    // keep the workers busy between frames instead of waiting for the next frame to hand out work
    if (this.onFree && !this.fallback) this.onFree();
  }
  // main-thread fallback (no Web Workers): spend more of the frame on chunk work when there is time to spare
  pump(frameMs) { if (this.fallback) this.fallback.pump(clamp(15 - (frameMs || 8), 3, 10)); }
}
