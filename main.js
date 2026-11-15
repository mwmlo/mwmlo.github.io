document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('stitch-canvas');
  const stitchCountEl = document.getElementById('stitch-count');
  const themeToggle = document.getElementById('theme-toggle');
  const themeLabel = themeToggle.querySelector('.theme-label');
  const paintingLabel = document.getElementById('painting-label');

  function updatePaintingLabel(id) {
    if (!paintingLabel) return;
    const painting = Paintings[id];
    if (painting) {
      paintingLabel.textContent = painting.title;
    }
  }

  const engine = new StitchEngine(canvas, {
    cellSize: 8,
    theme: 'ecru',
    autoCycle: true,
    cycleDelayMs: 1000,
    onCountChange: (count) => {
      stitchCountEl.textContent = count.toLocaleString();
    },
    onPaintingChange: (id) => {
      updatePaintingLabel(id);
    },
  });

  updatePaintingLabel(engine.paintingId);

  // Ecru / Midnight Aida theme toggle
  themeToggle.addEventListener('click', () => {
    const root = document.documentElement;
    const isMidnight = root.getAttribute('data-theme') === 'midnight';
    const nextTheme = isMidnight ? 'ecru' : 'midnight';
    root.setAttribute('data-theme', nextTheme);
    themeLabel.textContent = nextTheme === 'midnight' ? 'Midnight' : 'Ecru';
    engine.setTheme(nextTheme);
  });
});
