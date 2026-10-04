// ============================================================================
//  Launcher benchmark (?bench=<seconds>): opens a fixed test world at the player's settings, lets the terrain
//  load, times two phases of <seconds> each, deletes the world again and reports in the window title
//  (VCBENCH:{json}), where the desktop launcher reads it. The launcher runs this once per graphics backend and
//  ranks them by steady FPS over both phases. A still scene alone would mislead: Vulkan rendered one at 5000+ fps
//  here but streamed new terrain at under 300.
// ============================================================================
async function runBenchmark(g, secs) {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // a lost context reports its own failure (Game.onContextLost); nothing measured after it means anything
  const report = (o) => { if (!g.ctxLost) document.title = 'VCBENCH:' + JSON.stringify(o); };
  document.title = 'VoxelCraft benchmark';
  if (!GLX.gl) { report({ ok: false, error: 'WebGL 2 is not available with this backend' }); return; }
  try {
    // time what the hardware can do: no frame cap, no Auto Quality (none of this is saved)
    SETTINGS.fpsCap = 0; SETTINGS.menuVsync = false; SETTINGS.autoQuality = false; refreshEff();
    for (const w of await g.save.listWorlds()) if (w.bench) await g.save.deleteWorld(w.id);
    await g.createWorld({ name: 'Launcher benchmark', seed: 12345, seedText: '12345', mode: 'creative', difficulty: 0, type: 'default', structures: true, cheats: true, bonus: false, bench: true });
    const t0 = now();
    while (g.state !== 'playing') { if (now() - t0 > 90000) throw new Error('the test world did not load'); await sleep(100); }
    const id = g.meta.id, p = g.player, w = g.world;
    g.gameRules.doDaylightCycle = false; g.time = 6000;
    g.weather = { rain: false, thunder: false, timer: 1e9 }; g.rainLevel = g.thunderLevel = 0;
    p.flying = true; p.yaw = 0.7; p.pitch = -0.15;
    p.y = Math.max(p.y, w.heightAt(Math.floor(p.x), Math.floor(p.z)) + 6); p.savePrev();
    // terrain streams in and shaders compile before the timing starts
    const t1 = now();
    while (now() - t1 < 30000 && (w.pending.size || w.meshQueue.size || now() - t1 < 3000)) await sleep(200);
    await sleep(1500);
    // looking around on the spot, then flying a circle over new terrain at about 35 blocks a second
    const R = g.renderer, gpu = [], x0 = p.x, z0 = p.z, y0 = p.y, yaw0 = p.yaw;
    g.pacer.record();
    let t2 = now();
    while (now() - t2 < secs * 1000) { p.yaw = yaw0 + (now() - t2) / 1000 * 0.4; await sleep(30); if (R.tq && R.tq.valid) gpu.push(R.tq.ms); }
    const split = g.pacer.rec.length;
    t2 = now();
    while (now() - t2 < secs * 1000) {
      const a = (now() - t2) / 1000 * 0.12;
      p.x = x0 + Math.sin(a) * 280; p.z = z0 + (1 - Math.cos(a)) * 280; p.y = y0 + 30; p.yaw = a + Math.PI / 2; p.pitch = -0.2; p.savePrev();
      await sleep(30);
    }
    // steady FPS ranks the backends: the average alone hides stalls (see FramePacer.statsOf)
    const iv = g.pacer.rec; g.pacer.rec = null;
    const st = FramePacer.statsOf(iv), still = FramePacer.statsOf(iv.slice(0, split)), fly = FramePacer.statsOf(iv.slice(split));
    gpu.sort((a, b) => a - b);
    const res = {
      ok: true, fps: Math.round(st.fps * 10) / 10, steadyFps: Math.round(st.steadyFps * 10) / 10, hitches: st.hitches, queue: g.pacer.q,
      stillFps: Math.round(still.fps), flyFps: Math.round(fly.fps), flySteadyFps: Math.round(fly.steadyFps),
      gpuMs: gpu.length ? Math.round(gpu[gpu.length >> 1] * 1000) / 1000 : -1,
      cpuMs: Math.round(g.frameMs * 1000) / 1000, renderer: GLX.renderer || '', software: !!GLX.software,
      res: R.outW + 'x' + R.outH, preset: SETTINGS.preset, chunks: w.chunks.size,
    };
    await g.quitToTitle();
    await g.save.deleteWorld(id);
    report(res);
  } catch (e) { report({ ok: false, error: String(e && e.message || e), renderer: GLX.renderer || '' }); }
}
