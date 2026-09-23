// ============================================================================
//  Save system: IndexedDB (worlds + RLE-compressed chunks)
// ============================================================================
function rleEncode(a) {
  const out = []; let i = 0;
  while (i < a.length) { const v = a[i]; let n = 1; while (i + n < a.length && a[i + n] === v && n < 65535) n++; out.push(v, n); i += n; }
  return new Uint16Array(out);
}
function rleDecode(r, len) {
  const out = new Uint16Array(len); let o = 0;
  for (let i = 0; i < r.length; i += 2) { out.fill(r[i], o, o + r[i + 1]); o += r[i + 1]; }
  return out;
}
class Save {
  constructor(game) { this.game = game; this.db = null; this.worldId = null; this.pending = new Map(); this.memory = null; }
  async open() {
    if (this.db) return this.db;
    try {
      this.db = await new Promise((res, rej) => {
        const rq = indexedDB.open('voxelcraft', 1);
        rq.onupgradeneeded = () => {
          const db = rq.result;
          if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('chunks')) { const s = db.createObjectStore('chunks', { keyPath: 'k' }); s.createIndex('w', 'w'); }
        };
        rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
      });
    } catch (e) { console.warn('IndexedDB unavailable, saves are in-memory only', e); this.memory = { worlds: new Map(), chunks: new Map() }; }
    return this.db;
  }
  tx(store, mode) { return this.db.transaction(store, mode).objectStore(store); }
  req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async listWorlds() {
    await this.open();
    if (this.memory) return [...this.memory.worlds.values()];
    const all = await this.req(this.tx('worlds', 'readonly').getAll());
    return all.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
  }
  async putWorld(meta) { await this.open(); if (this.memory) { this.memory.worlds.set(meta.id, meta); return; } await this.req(this.tx('worlds', 'readwrite').put(meta)); }
  async deleteWorld(id) {
    await this.open();
    if (this.memory) { this.memory.worlds.delete(id); for (const k of [...this.memory.chunks.keys()]) if (k.startsWith(id + '|')) this.memory.chunks.delete(k); return; }
    await this.req(this.tx('worlds', 'readwrite').delete(id));
    const store = this.tx('chunks', 'readwrite');
    const keys = await this.req(store.index('w').getAllKeys(IDBKeyRange.only(id)));
    const st2 = this.tx('chunks', 'readwrite');
    for (const k of keys) st2.delete(k);
  }
  async chunkKeys(worldId, dim) {
    await this.open();
    const set = new Set(), pre = worldId + '|' + dim + '|';
    let keys;
    if (this.memory) keys = [...this.memory.chunks.keys()];
    else keys = await this.req(this.tx('chunks', 'readonly').index('w').getAllKeys(IDBKeyRange.only(worldId)));
    for (const k of keys) if (k.startsWith(pre)) { const [cx, cz] = k.slice(pre.length).split(',').map(Number); set.add(ckey(cx, cz)); }
    return set;
  }
  key(dim, cx, cz) { return this.worldId + '|' + dim + '|' + cx + ',' + cz; }
  async loadChunk(dim, cx, cz) {
    const k = this.key(dim, cx, cz);
    let rec = this.pending.get(k);
    if (!rec) { await this.open(); rec = this.memory ? this.memory.chunks.get(k) : await this.req(this.tx('chunks', 'readonly').get(k)); }
    if (!rec) return null;
    return { blocks: rleDecode(rec.b, CVOL), be: rec.be ? JSON.parse(JSON.stringify(rec.be)) : [], ents: rec.e || [], tags: rec.tags || 0 };
  }
  saveChunk(world, c) {
    if (!this.worldId) return;
    const ents = [];
    for (const e of world.entities) if (!e.removed && e.persistent && e.serialize && Math.floor(e.x) >> 4 === c.cx && Math.floor(e.z) >> 4 === c.cz) ents.push(e.serialize());
    const be = [...c.be.values()].map(b => { const o = Object.assign({}, b); return o; });
    const k = this.key(world.dim, c.cx, c.cz);
    this.pending.set(k, { k, w: this.worldId, b: rleEncode(c.blocks), be, e: ents, tags: c.tags });
    world.savedKeys.add(c.key);
    c.modified = false;
    if (this.pending.size > 32) this.flush();
  }
  async flush() {
    if (!this.pending.size) return;
    const recs = [...this.pending.values()]; this.pending.clear();
    await this.open();
    if (this.memory) { for (const r of recs) this.memory.chunks.set(r.k, r); return; }
    await new Promise((res) => {
      const t = this.db.transaction('chunks', 'readwrite'); const s = t.objectStore('chunks');
      for (const r of recs) s.put(r);
      t.oncomplete = res; t.onerror = () => { console.warn('chunk save failed', t.error); res(); };
    });
  }
}
