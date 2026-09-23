// ============================================================================
//  Boot
// ============================================================================
window.addEventListener('load', () => {
  const g = window.GAME = new Game();
  setTimeout(() => g.boot().catch((e) => {
    console.error(e);
    const f = $('#fatal'); f.style.display = 'flex';
    f.innerHTML = '<div><h1>Failed to start</h1><pre></pre></div>';
    f.querySelector('pre').textContent = String(e && e.stack || e);
  }), 30);
});
