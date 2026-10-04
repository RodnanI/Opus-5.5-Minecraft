// ============================================================================
//  Boot
// ============================================================================
window.addEventListener('load', () => {
  const g = window.GAME = new Game();
  setTimeout(() => g.boot().then(() => {
    if (LAUNCH.desktop && document.title === 'VoxelCraft (starting)') document.title = 'VoxelCraft';
    if (LAUNCH.bench) runBenchmark(g, LAUNCH.bench);
  }).catch((e) => {
    console.error(e);
    if (g.ctxLost) return;   // its own message is already up (a lost context makes the boot fail too)
    const f = $('#fatal'); f.style.display = 'flex';
    f.innerHTML = '<div><h1>Failed to start</h1><pre></pre></div>';
    f.querySelector('pre').textContent = String(e && e.stack || e);
  }), LAUNCH.bootDelay || 30);
});
