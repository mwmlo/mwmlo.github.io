/**
 * High-Detail Cross-Stitch Embroidery Canvas Engine
 * - Offscreen fabric & settled-stitch caching for 60fps performance
 * - Two-pass animated thread-pulling visualization (curved slack -> taut X)
 * - Famous paintings sewn grouped by color via BFS, with automatic transitions
 *   that unthread only the squares whose colors need to change
 * - Hover interaction: unstitches and restitches the thread directly under
 *   the cursor while hovered and for 1s after the cursor leaves the square
 */
class StitchEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.cellSize = options.cellSize || 8;
    this.theme = options.theme || 'ecru';
    this.paintingId = options.paintingId || 'water-lilies';
    this.autoCycle = options.autoCycle !== false;
    this.cycleDelayMs = options.cycleDelayMs || 1000;

    this.onCountChange = options.onCountChange || (() => {});
    this.onPaintingChange = options.onPaintingChange || (() => {});

    this.stitches = new Map(); // key: "col,row" -> stitch object
    this.unthreadQueue = [];
    this.sewQueue = [];
    this.activeAnimations = new Set();

    this.hoverCell = null;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = 0;
    this.height = 0;
    this.cols = 0;
    this.rows = 0;

    this.fabricCanvas = document.createElement('canvas');
    this.fabricCtx = this.fabricCanvas.getContext('2d');

    this.settledCanvas = document.createElement('canvas');
    this.settledCtx = this.settledCanvas.getContext('2d');

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.rafId = null;
    this.lastFrameTime = 0;
    this.autoTimer = null;

    this.bindEvents();
    this.resize();
  }

  getThemeColors() {
    if (this.theme === 'midnight') {
      return {
        bg: '#161c26',
        weaveA: 'rgba(180, 200, 230, 0.045)',
        weaveB: 'rgba(10, 14, 22, 0.22)',
        hole: 'rgba(6, 9, 15, 0.55)',
        hoverRing: 'rgba(224, 120, 80, 0.65)',
      };
    }
    return {
      bg: '#f4efe6',
      weaveA: 'rgba(165, 148, 124, 0.13)',
      weaveB: 'rgba(255, 252, 245, 0.38)',
      hole: 'rgba(122, 106, 86, 0.18)',
      hoverRing: 'rgba(200, 90, 50, 0.6)',
    };
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.cols = Math.ceil(this.width / this.cellSize);
    this.rows = Math.ceil(this.height / this.cellSize);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.buildFabricCache();
    this.loadMonetPainting(this.paintingId, true, false);
  }

  buildFabricCache() {
    const s = this.cellSize;
    const palette = this.getThemeColors();
    const wPx = Math.floor(this.width * this.dpr);
    const hPx = Math.floor(this.height * this.dpr);

    this.fabricCanvas.width = wPx;
    this.fabricCanvas.height = hPx;
    this.settledCanvas.width = wPx;
    this.settledCanvas.height = hPx;

    const fctx = this.fabricCtx;
    fctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    fctx.fillStyle = palette.bg;
    fctx.fillRect(0, 0, this.width, this.height);

    fctx.lineWidth = 1;
    const step = Math.max(3, s / 2);
    for (let x = 0; x <= this.width; x += step) {
      fctx.strokeStyle = Math.round(x / step) % 2 === 0 ? palette.weaveA : palette.weaveB;
      fctx.beginPath();
      fctx.moveTo(x + 0.5, 0);
      fctx.lineTo(x + 0.5, this.height);
      fctx.stroke();
    }

    for (let y = 0; y <= this.height; y += step) {
      fctx.strokeStyle = Math.round(y / step) % 2 === 0 ? palette.weaveA : palette.weaveB;
      fctx.beginPath();
      fctx.moveTo(0, y + 0.5);
      fctx.lineTo(this.width, y + 0.5);
      fctx.stroke();
    }

    fctx.fillStyle = palette.hole;
    const holeRadius = Math.max(0.55, s * 0.055);
    for (let c = 0; c <= this.cols; c++) {
      const px = c * s;
      for (let r = 0; r <= this.rows; r++) {
        const py = r * s;
        fctx.beginPath();
        fctx.arc(px, py, holeRadius, 0, Math.PI * 2);
        fctx.fill();
      }
    }

    this.rebuildSettledCache();
  }

  rebuildSettledCache() {
    this.settledCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.settledCtx.drawImage(this.fabricCanvas, 0, 0);
    this.settledCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    for (const [k, stitch] of this.stitches.entries()) {
      if (
        !this.activeAnimations.has(k) &&
        !stitch.unthreading &&
        !stitch.hoverActive &&
        stitch.progress >= 1
      ) {
        this.drawCrossStitch(this.settledCtx, stitch);
      }
    }
  }

  eraseCellFromSettled(col, row) {
    const s = this.cellSize;
    const sx = Math.max(0, Math.floor(col * s * this.dpr));
    const sy = Math.max(0, Math.floor(row * s * this.dpr));
    const sw = Math.ceil(s * this.dpr);
    const sh = Math.ceil(s * this.dpr);

    this.settledCtx.save();
    this.settledCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.settledCtx.drawImage(this.fabricCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
    this.settledCtx.restore();
  }

  setTheme(theme) {
    this.theme = theme;
    this.buildFabricCache();
    this.requestDraw();
  }

  key(col, row) {
    return `${col},${row}`;
  }

  addStitch(col, row, color, animate = true) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return;
    const k = this.key(col, row);
    const seed = ((col * 73856093) ^ (row * 19349663)) & 0xffff;
    const stitch = {
      col,
      row,
      color,
      progress: animate && !this.reducedMotion ? 0.02 : 1,
      seed,
      unthreading: false,
      hoverActive: false,
      hoverDir: -1,
      hoverUntil: 0,
    };

    const existed = this.stitches.has(k);
    this.stitches.set(k, stitch);

    if (stitch.progress < 1) {
      this.activeAnimations.add(k);
      if (existed) this.eraseCellFromSettled(col, row);
    } else {
      this.drawCrossStitch(this.settledCtx, stitch);
    }

    this.onCountChange(this.stitches.size);
    this.requestDraw();
  }

  startUnthreading(col, row) {
    const k = this.key(col, row);
    const stitch = this.stitches.get(k);
    if (!stitch) return;

    if (this.reducedMotion) {
      this.removeStitch(col, row);
      return;
    }

    stitch.unthreading = true;
    stitch.hoverActive = false;
    this.eraseCellFromSettled(col, row);
    this.activeAnimations.add(k);
    this.requestDraw();
  }

  removeStitch(col, row) {
    const k = this.key(col, row);
    if (this.stitches.delete(k)) {
      this.activeAnimations.delete(k);
      this.eraseCellFromSettled(col, row);
      this.onCountChange(this.stitches.size);
      this.requestDraw();
    }
  }

  cancelAutoCycle() {
    if (this.autoTimer !== null) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
  }

  scheduleNextPainting() {
    this.cancelAutoCycle();
    if (!this.autoCycle) return;

    const ids = Object.keys(Paintings);
    const currentIdx = ids.indexOf(this.paintingId);
    const nextId = ids[(currentIdx + 1) % ids.length];

    this.autoTimer = setTimeout(() => {
      this.autoTimer = null;
      this.loadMonetPainting(nextId, true, true);
    }, this.cycleDelayMs);
  }

  /**
   * Groups items by color (largest groups first), and orders stitches
   * within each color using Breadth-First Search (BFS) over 4-connected regions.
   */
  groupByColor(items) {
    const groups = new Map();
    for (const item of items) {
      if (!groups.has(item.color)) {
        groups.set(item.color, []);
      }
      groups.get(item.color).push(item);
    }

    const sortedGroups = Array.from(groups.values()).sort((a, b) => b.length - a.length);
    const result = [];
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (const group of sortedGroups) {
      const cellMap = new Map();
      for (const item of group) {
        cellMap.set(this.key(item.col, item.row), item);
      }

      const visited = new Set();
      for (const startItem of group) {
        const startKey = this.key(startItem.col, startItem.row);
        if (visited.has(startKey)) continue;

        const queue = [startItem];
        visited.add(startKey);
        let head = 0;

        while (head < queue.length) {
          const curr = queue[head++];
          result.push(curr);

          for (const [dc, dr] of dirs) {
            const nk = this.key(curr.col + dc, curr.row + dr);
            if (!visited.has(nk) && cellMap.has(nk)) {
              visited.add(nk);
              queue.push(cellMap.get(nk));
            }
          }
        }
      }
    }
    return result;
  }

  loadMonetPainting(paintingId, animate = true, transition = true) {
    this.cancelAutoCycle();
    this.paintingId = paintingId;
    this.onPaintingChange(paintingId);

    const painting = Paintings[paintingId] || Paintings['water-lilies'];
    const toUnthread = [];
    const toSew = [];

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const u = (c + 0.5) / this.cols;
        const v = (r + 0.5) / this.rows;
        const targetColor = painting.sample(u, v, c, r);
        const existing = this.stitches.get(this.key(c, r));

        if (transition && existing && !existing.unthreading) {
          if (existing.color === targetColor) {
            continue;
          }
          toUnthread.push({ col: c, row: r, color: existing.color });
          toSew.push({ col: c, row: r, color: targetColor });
        } else {
          toSew.push({ col: c, row: r, color: targetColor });
        }
      }
    }

    if (!transition) {
      this.stitches.clear();
      this.activeAnimations.clear();
      this.rebuildSettledCache();
      this.onCountChange(0);
    }

    this.unthreadQueue = this.groupByColor(toUnthread);
    this.sewQueue = this.groupByColor(toSew);

    if (!animate || this.reducedMotion) {
      for (const item of this.unthreadQueue) {
        this.removeStitch(item.col, item.row);
      }
      this.unthreadQueue = [];
      for (const item of this.sewQueue) {
        this.addStitch(item.col, item.row, item.color, false);
      }
      this.sewQueue = [];
      this.scheduleNextPainting();
      return;
    }

    this.requestDraw();
  }

  activateHoverStitch(col, row) {
    if (this.reducedMotion) return;
    const k = this.key(col, row);
    const stitch = this.stitches.get(k);
    if (!stitch || stitch.unthreading) return;

    stitch.hoverUntil = performance.now() + 1000;
    if (!stitch.hoverActive) {
      stitch.hoverActive = true;
      stitch.hoverDir = -1; // Start by unstitching
      this.eraseCellFromSettled(col, row);
      this.activeAnimations.add(k);
    }
    this.requestDraw();
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());

    // Track pointer across window so hover works on the cloth
    window.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) {
        this.hoverCell = null;
        return;
      }

      const cell = {
        col: Math.floor(x / this.cellSize),
        row: Math.floor(y / this.cellSize),
      };
      this.hoverCell = cell;
      this.activateHoverStitch(cell.col, cell.row);
      this.requestDraw();
    });

    document.addEventListener('pointerleave', () => {
      this.hoverCell = null;
      this.requestDraw();
    });
  }

  requestDraw() {
    if (this.rafId !== null) return;
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame((now) => this.tick(now));
  }

  tick(now) {
    this.rafId = null;
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;

    // Keep refreshing hoverUntil while cursor remains on the square
    if (this.hoverCell) {
      const hk = this.key(this.hoverCell.col, this.hoverCell.row);
      const hoveredStitch = this.stitches.get(hk);
      if (hoveredStitch && !hoveredStitch.unthreading) {
        hoveredStitch.hoverUntil = now + 1000;
      }
    }

    const total = Math.max(1, this.cols * this.rows);

    // Phase 1: Unthread changed squares first
    if (this.unthreadQueue.length > 0) {
      const unthreadBatch = Math.max(3, Math.ceil(total / 450));
      for (let i = 0; i < unthreadBatch && this.unthreadQueue.length > 0; i++) {
        const next = this.unthreadQueue.shift();
        this.startUnthreading(next.col, next.row);
      }
    } else if (this.sewQueue.length > 0) {
      // Phase 2: Slow procedural sewing grouped by color (BFS)
      const sewBatch = Math.max(2, Math.ceil(total / 850));
      for (let i = 0; i < sewBatch && this.sewQueue.length > 0; i++) {
        const next = this.sewQueue.shift();
        this.addStitch(next.col, next.row, next.color, true);
      }
    }

    // Advance active thread-pull, unthread, and hover unstitch/restitch animations
    for (const k of this.activeAnimations) {
      const s = this.stitches.get(k);
      if (!s) {
        this.activeAnimations.delete(k);
        continue;
      }

      if (s.unthreading) {
        s.progress = Math.max(0, s.progress - dt * 1.8);
        if (s.progress <= 0) {
          this.activeAnimations.delete(k);
          this.stitches.delete(k);
          this.onCountChange(this.stitches.size);
        }
        continue;
      }

      if (s.hoverActive) {
        if (now < s.hoverUntil) {
          // Continuously unstitch and restitch while hovered + 1s after
          s.progress += s.hoverDir * dt * 2.2;
          if (s.progress <= 0) {
            s.progress = 0;
            s.hoverDir = 1;
          } else if (s.progress >= 1) {
            s.progress = 1;
            s.hoverDir = -1;
          }
        } else {
          // 1s grace period ended: finish restitching to 1.0 and settle
          s.hoverDir = 1;
          s.progress = Math.min(1, s.progress + dt * 2.2);
          if (s.progress >= 1) {
            s.hoverActive = false;
            this.activeAnimations.delete(k);
            this.drawCrossStitch(this.settledCtx, s);
          }
        }
        continue;
      }

      // Normal initial sew-in animation
      if (s.progress < 1) {
        s.progress = Math.min(1, s.progress + dt * 1.5);
        if (s.progress >= 1) {
          this.activeAnimations.delete(k);
          this.drawCrossStitch(this.settledCtx, s);
        }
      } else {
        this.activeAnimations.delete(k);
        this.drawCrossStitch(this.settledCtx, s);
      }
    }

    this.draw();

    if (
      this.unthreadQueue.length > 0 ||
      this.sewQueue.length > 0 ||
      this.activeAnimations.size > 0
    ) {
      this.requestDraw();
    } else if (this.stitches.size > 0 && this.autoTimer === null) {
      this.scheduleNextPainting();
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.settledCanvas, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    for (const k of this.activeAnimations) {
      const stitch = this.stitches.get(k);
      if (stitch) {
        this.drawCrossStitch(ctx, stitch);
      }
    }

    if (this.hoverCell) {
      const { col, row } = this.hoverCell;
      const s = this.cellSize;
      const x = col * s;
      const y = row * s;
      const palette = this.getThemeColors();

      ctx.save();
      ctx.strokeStyle = palette.hoverRing;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
      ctx.restore();
    }
  }

  drawCrossStitch(ctx, stitch) {
    const s = this.cellSize;
    const pad = s * 0.14;
    const jitter = ((stitch.seed % 5) - 2) * 0.1;

    const x1 = stitch.col * s + pad + jitter;
    const y1 = stitch.row * s + pad;
    const x2 = (stitch.col + 1) * s - pad + jitter;
    const y2 = (stitch.row + 1) * s - pad;

    const thickness = Math.max(1.2, s * 0.22);
    const p = stitch.progress;

    const p1 = Math.min(1, p * 2);
    if (p1 > 0) {
      this.drawAnimatedThread(ctx, x1, y1, x2, y2, p1, stitch.color, thickness, false);
    }

    if (p > 0.5) {
      const p2 = Math.min(1, (p - 0.5) * 2);
      this.drawAnimatedThread(ctx, x2, y1, x1, y2, p2, stitch.color, thickness, true);
    }
  }

  drawAnimatedThread(ctx, x1, y1, x2, y2, progress, color, width, isOverThread) {
    const ex = x1 + (x2 - x1) * progress;
    const ey = y1 + (y2 - y1) * progress;

    const slack = Math.sin(progress * Math.PI) * (this.cellSize * 0.45);
    const cx = (x1 + ex) * 0.5;
    const cy = (y1 + ey) * 0.5 - slack;

    ctx.lineCap = 'round';

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1 + 0.7);
    if (progress < 0.99) {
      ctx.quadraticCurveTo(cx, cy + 0.7, ex, ey + 0.7);
    } else {
      ctx.lineTo(ex, ey + 0.7);
    }
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    if (progress < 0.99) {
      ctx.quadraticCurveTo(cx, cy, ex, ey);
    } else {
      ctx.lineTo(ex, ey);
    }
    ctx.stroke();

    if (isOverThread) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = Math.max(0.5, width * 0.26);
      ctx.beginPath();
      ctx.moveTo(x1, y1 - 0.25);
      if (progress < 0.99) {
        ctx.quadraticCurveTo(cx, cy - 0.25, ex, ey - 0.25);
      } else {
        ctx.lineTo(ex, ey - 0.25);
      }
      ctx.stroke();
    }

    if (progress > 0.05 && progress < 0.96) {
      ctx.fillStyle = '#f8f5ee';
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(0.9, width * 0.42), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
