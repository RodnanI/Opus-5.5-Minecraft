// ============================================================================
//  Worker: terrain generation, chunk lighting and section meshing
// ============================================================================
let GENS = null, MESHER = null;
self.onmessage = (e) => {
  const m = e.data;
  try {
    switch (m.t) {
      case 'init':
        GENS = { overworld: new OverworldGen(m.seed, m.opts), nether: new NetherGen(m.seed) };
        MESHER = new Mesher();
        break;
      case 'gen': {
        const r = GENS[m.dim].generate(m.cx, m.cz);
        const light = new Uint8Array(CVOL), hm = new Uint8Array(256);
        computeChunkLight(r.blocks, light, hm, false);
        self.postMessage({ t: 'gen', id: m.id, dim: m.dim, cx: m.cx, cz: m.cz, blocks: r.blocks, light, hm, biomes: r.biomes, tints: r.tints, be: r.be, spawns: r.spawns, tags: r.tags },
          [r.blocks.buffer, light.buffer, hm.buffer, r.biomes.buffer]);
        break;
      }
      case 'light': {
        const light = new Uint8Array(CVOL), hm = new Uint8Array(256);
        computeChunkLight(m.blocks, light, hm, false);
        let biomes = m.biomes, tints = m.tints;
        if (!biomes || !tints) {
          const g = GENS[m.dim];
          if (m.dim === 'overworld') {
            const r2 = { biomes: new Uint8Array(256) };
            for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) r2.biomes[z * 16 + x] = g.climateCached(m.cx * 16 + x, m.cz * 16 + z).biome;
            biomes = r2.biomes; tints = g.tints(m.cx * 16, m.cz * 16);
          } else {
            biomes = new Uint8Array(256); for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) biomes[z * 16 + x] = g.biomeAt(m.cx * 16 + x, m.cz * 16 + z);
            const c = new Uint32Array(256).fill(0xBFB755); tints = { grass: c, foliage: c, water: new Uint32Array(256).fill(0x3F76E4) };
          }
        }
        self.postMessage({ t: 'light', id: m.id, dim: m.dim, cx: m.cx, cz: m.cz, blocks: m.blocks, light, hm, biomes, tints }, [m.blocks.buffer, light.buffer, hm.buffer]);
        break;
      }
      case 'mesh': {
        const r = MESHER.mesh(m.pb, m.pl, m.tints, m.ox, m.oy, m.oz, m.opts);
        self.postMessage({ t: 'mesh', id: m.id, key: m.key, sy: m.sy, ver: m.ver, layers: r.layers, counts: r.counts, vis: r.vis }, r.layers);
        break;
      }
      case 'locate': {
        const g = GENS[m.dim];
        const res = g.structs.locate(m.type, m.x, m.z, 14);
        self.postMessage({ t: 'locate', id: m.id, res });
        break;
      }
      case 'biome': {
        const g = GENS.overworld;
        let found = null;
        for (let r = 0; r < 3000 && !found; r += 32) {
          for (let a = 0; a < 16 && !found; a++) {
            const x = Math.round(m.x + Math.cos(a / 16 * Math.PI * 2) * r), z = Math.round(m.z + Math.sin(a / 16 * Math.PI * 2) * r);
            if (g.climateCached(x, z).biome === m.biome) found = { x, z };
          }
        }
        self.postMessage({ t: 'biome', id: m.id, res: found });
        break;
      }
    }
  } catch (err) {
    self.postMessage({ t: 'error', id: m.id, msg: String(err && err.stack || err) });
  }
};
