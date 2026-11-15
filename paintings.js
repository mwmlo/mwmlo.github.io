/**
 * Procedural Cross-Stitch Recreations of Famous Paintings
 * Uses multi-octave painterly noise, directional brushwork, and
 * 4x4 ordered Bayer dithering over expanded DMC-inspired thread palettes
 * for rich color variation and fine detail.
 */
const Paintings = (() => {
  const BAYER_4X4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  function bayerDither(col, row, spread = 0.16) {
    const b = BAYER_4X4[row & 3][col & 3] / 16 - 0.5;
    const h = hash2D(col, row) - 0.5;
    return (b * 0.68 + h * 0.32) * spread;
  }

  function hash2D(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function noise2D(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);

    const a = hash2D(ix, iy);
    const b = hash2D(ix + 1, iy);
    const c = hash2D(ix, iy + 1);
    const d = hash2D(ix + 1, iy + 1);

    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function fbm(x, y) {
    return (
      noise2D(x, y) * 0.55 +
      noise2D(x * 2.15, y * 2.15) * 0.30 +
      noise2D(x * 4.4, y * 4.4) * 0.15
    );
  }

  function clamp01(t) {
    return Math.min(0.999, Math.max(0, t));
  }

  function pick(palette, t) {
    const idx = Math.floor(clamp01(t) * palette.length);
    return palette[idx];
  }

  /**
   * 1. Monet — Water Lilies (Nymphéas, 1906)
   */
  function waterLilies(u, v, col, row) {
    const pondPalette = [
      '#172b40', '#1f3a54', '#294d6b', '#35607d',
      '#44738c', '#568699', '#6b96a3', '#82a6b0', '#707aa1',
    ];
    const willowPalette = ['#2d4739', '#3b5c47', '#4c7055', '#608564', '#779972', '#8fad80'];
    const padPalette = ['#395938', '#4b7047', '#5d8554', '#729963', '#88ad72', '#a1bf82'];
    const blossomPalette = ['#d67c87', '#e39ea6', '#ebbcc1', '#f2d5d8', '#f7ebe6', '#ebd086'];

    const d = bayerDither(col, row, 0.22);
    const ripple = fbm(u * 9 + Math.sin(v * 14) * 0.35, v * 16);
    const dab = noise2D(u * 32, v * 12);

    // Hanging weeping willow tendrils at top
    if (v < 0.26 + ripple * 0.14) {
      const strand = Math.sin(u * 45 + noise2D(u * 10, v * 10) * 3) * 0.5 + 0.5;
      const n = fbm(u * 12, v * 18) * 0.65 + strand * 0.35 + d;
      if (n > 0.44) return pick(willowPalette, n);
      return pick(pondPalette, 0.35 + n * 0.6);
    }

    // Varied lily pad clusters with notched edges & multi-toned blossoms
    const clusters = [
      { cx: 0.20, cy: 0.44, rx: 0.15, ry: 0.075 },
      { cx: 0.74, cy: 0.40, rx: 0.17, ry: 0.085 },
      { cx: 0.47, cy: 0.64, rx: 0.21, ry: 0.105 },
      { cx: 0.17, cy: 0.78, rx: 0.16, ry: 0.085 },
      { cx: 0.81, cy: 0.74, rx: 0.16, ry: 0.095 },
      { cx: 0.36, cy: 0.49, rx: 0.10, ry: 0.055 },
      { cx: 0.62, cy: 0.83, rx: 0.12, ry: 0.065 },
    ];

    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      const dx = (u - c.cx) / c.rx;
      const dy = (v - c.cy) / c.ry;
      const dist = dx * dx + dy * dy + (fbm(u * 20, v * 20) - 0.5) * 0.5;

      if (dist < 0.96) {
        const flowerNoise = hash2D(col * 0.8 + i * 17, row * 0.8);
        if (dist < 0.46 && flowerNoise > 0.74) {
          return pick(blossomPalette, (flowerNoise - 0.74) / 0.26 + d * 0.4);
        }
        return pick(padPalette, 0.28 + (1 - dist) * 0.62 + dab * 0.18 + d);
      }
    }

    // Dappled lavender/sky/willow reflections in water
    if (dab > 0.68 && v < 0.62) {
      return pick(willowPalette, dab * 0.75 + d);
    }
    return pick(pondPalette, ripple * 0.78 + dab * 0.22 + d);
  }

  /**
   * 2. Monet — Impression, Sunrise (1872)
   */
  function impressionSunrise(u, v, col, row) {
    const skyPalette = [
      '#51657a', '#64798f', '#788da1', '#8ea1b2',
      '#a8b0ba', '#c2b0a9', '#d6aa89', '#e3b88d', '#ebc99d',
    ];
    const waterPalette = [
      '#384c61', '#475e73', '#5a7287', '#6f8699',
      '#8798a6', '#a89f9e', '#c49678',
    ];
    const sunPalette = ['#cf4625', '#de5e2f', '#eb7a3b', '#f2984b', '#f7b963'];
    const boatPalette = ['#1d2530', '#2b3542', '#3a4657', '#4b5869'];

    const d = bayerDither(col, row, 0.2);
    const horizon = 0.54;
    const sunX = 0.46;
    const sunY = 0.39;
    const sunDist = Math.hypot((u - sunX) * 1.45, v - sunY);

    if (sunDist < 0.068) {
      return pick(sunPalette, 1 - sunDist / 0.068 + d * 0.5);
    }

    if (v < horizon) {
      const mist = fbm(u * 8, v * 11);
      const warmth = Math.max(0, 1 - sunDist * 2.2) * 0.48 + (v / horizon) * 0.32;
      return pick(skyPalette, mist * 0.48 + warmth + d);
    }

    // Broken sun reflection shimmer across water ripples
    const reflectWidth = 0.055 + (v - horizon) * 0.095;
    const waveOffset = Math.sin(v * 54) * 0.016 + (noise2D(u * 18, v * 28) - 0.5) * 0.015;
    if (Math.abs(u - (sunX + waveOffset)) < reflectWidth) {
      const shimmer = fbm(u * 30, v * 38) + d;
      if (shimmer > 0.36) {
        return pick(sunPalette, shimmer);
      }
    }

    // Foreground fishing boat & reflection
    const boatDx = (u - 0.34) / 0.09;
    const boatDy = (v - 0.72) / 0.032;
    if (boatDx * boatDx + boatDy * boatDy < 1.0 && v >= 0.70) {
      return pick(boatPalette, fbm(u * 25, v * 25) * 0.6 + d);
    }
    if (Math.abs(u - 0.33) < 0.012 && v >= 0.64 && v <= 0.72) {
      return boatPalette[1];
    }

    // Second boat & distant harbor masts/cranes
    const b2Dx = (u - 0.21) / 0.055;
    const b2Dy = (v - 0.61) / 0.02;
    if (b2Dx * b2Dx + b2Dy * b2Dy < 1.0 && v >= 0.59) {
      return boatPalette[1];
    }
    if (u > 0.05 && u < 0.29 && v > 0.42 && v < horizon) {
      if (noise2D(u * 40, v * 12) > 0.73) return boatPalette[2];
    }

    const ripple = fbm(u * 14, v * 26) + d;
    return pick(waterPalette, ripple);
  }

  /**
   * 3. Van Gogh — The Starry Night (1889)
   */
  function starryNight(u, v, col, row) {
    const skyPalette = [
      '#0f1d3b', '#172c57', '#203e75', '#2c5394',
      '#3c6bb0', '#5386c7', '#73a4db', '#9ec2e6',
    ];
    const starPalette = ['#d99f2b', '#ebb93d', '#f5d76e', '#faecc0'];
    const cypressPalette = ['#0d1712', '#15241c', '#1e3328', '#2a4536', '#395742'];
    const hillPalette = ['#132036', '#1c2f4d', '#253e63', '#314f7a'];

    const d = bayerDither(col, row, 0.2);

    // Flame-like cypress tree on left
    const cypressCenter = 0.18 + Math.sin(v * 20) * 0.022;
    const cypressWidth = Math.max(0, (v - 0.13) * 0.125);
    if (v > 0.13 && Math.abs(u - cypressCenter) < cypressWidth) {
      const flame = Math.sin(v * 35 + u * 25) * 0.25 + fbm(u * 22, v * 22) * 0.75 + d;
      return pick(cypressPalette, flame);
    }

    // Rolling hills, village roofs & church steeple
    const hillLine = 0.73 + Math.sin(u * 7.5) * 0.045 + Math.cos(u * 15) * 0.02;
    const inSteeple = Math.abs(u - 0.62) < (v - 0.62) * 0.14 && v > 0.62 && v < 0.76;
    if (v >= hillLine || inSteeple) {
      if (v > 0.79 && v < 0.90 && u > 0.34 && u < 0.86 && hash2D(col * 1.9, row * 2.3) > 0.95) {
        return '#f2c94c';
      }
      return pick(hillPalette, fbm(u * 14, v * 16) + d);
    }

    // Crescent Moon + concentric glowing halo
    const moonDist = Math.hypot((u - 0.82) * 1.4, v - 0.22);
    const moonCutDist = Math.hypot((u - 0.79) * 1.4, v - 0.20);
    if (moonDist < 0.065 && moonCutDist > 0.052) {
      return pick(starPalette, 0.75 + d * 0.5);
    }
    if (moonDist < 0.14) {
      const halo = 1 - moonDist / 0.14 + d * 0.65;
      if (halo > 0.42) return pick(starPalette, halo * 0.75);
    }

    // Radiant stars with swirling halos
    const stars = [
      [0.32, 0.24, 0.055], [0.52, 0.17, 0.048], [0.64, 0.34, 0.06],
      [0.42, 0.48, 0.048], [0.11, 0.20, 0.042], [0.74, 0.52, 0.048],
      [0.24, 0.38, 0.036], [0.89, 0.42, 0.038],
    ];
    for (const [sx, sy, sr] of stars) {
      const sd = Math.hypot((u - sx) * 1.4, v - sy);
      if (sd < sr * 0.42) return starPalette[3];
      if (sd < sr * (0.95 + d * 0.4)) return pick(starPalette, 1 - sd / sr + d * 0.3);
    }

    // Swirling impasto sky currents
    const swirl = Math.sin(u * 13 + Math.sin(v * 11) * 2.3) * 0.5 + 0.5;
    const dash = noise2D(u * 28, v * 16);
    const skyVal = swirl * 0.48 + fbm(u * 10, v * 10) * 0.34 + dash * 0.18 + d;
    return pick(skyPalette, skyVal);
  }

  /**
   * 4. Hokusai — The Great Wave off Kanagawa (1831)
   */
  function greatWave(u, v, col, row) {
    const skyPalette = ['#cfc0a3', '#dcd0b6', '#e8dec6', '#f0e8d5', '#debba8'];
    const wavePalette = ['#0f2540', '#16355c', '#204a7d', '#2e6199', '#457cb3', '#679ac7', '#8ab4d6'];
    const foamPalette = ['#d5e0e8', '#e8eceb', '#f5f2ea', '#fcfaf5'];

    const d = bayerDither(col, row, 0.18);

    // Mount Fuji with snow ridges
    const fujiCenter = 0.68;
    const fujiSlope = Math.abs(u - fujiCenter);
    const fujiTop = 0.63 + fujiSlope * 1.35;
    if (v >= fujiTop && v < 0.84 && fujiSlope < 0.16) {
      const snowLine = 0.69 + Math.sin(u * 65) * 0.012;
      if (v < snowLine) return pick(foamPalette, 0.5 + d);
      return pick(wavePalette, 0.22 + fbm(u * 18, v * 18) * 0.35 + d);
    }

    // Sweeping Great Wave & curling foam claws
    const crestCurve = 0.23 + Math.pow((u - 0.44) * 1.75, 2) * 0.65;
    const underCurl = Math.hypot((u - 0.48) * 1.25, v - 0.44);
    const inMainWave = v > crestCurve && u < 0.67 && underCurl > 0.125;
    const inLowerWave = v > 0.67 + Math.sin(u * 9.5) * 0.065;

    // Spray droplets near crest
    if (!inMainWave && v > 0.16 && v < 0.45 && u > 0.30 && u < 0.64) {
      if (hash2D(col * 1.7, row * 1.3) > 0.965 && fbm(u * 12, v * 12) > 0.48) {
        return foamPalette[2];
      }
    }

    if (inMainWave || inLowerWave) {
      const nearCrest = Math.abs(v - crestCurve) < 0.055 + hash2D(col, row) * 0.035;
      const nearCurl = underCurl < 0.17 && u > 0.33 && v < 0.53;
      if ((inMainWave && (nearCrest || nearCurl)) || (inLowerWave && v < 0.72 + Math.sin(u * 9.5) * 0.065)) {
        return pick(foamPalette, 0.45 + fbm(u * 22, v * 22) * 0.4 + d);
      }
      const streak = Math.sin(u * 18 + v * 12) * 0.28 + fbm(u * 14, v * 14) * 0.72 + d;
      return pick(wavePalette, streak);
    }

    const skyT = (v < 0.62 ? 0.45 : 0.85) * 0.38 + fbm(u * 6, v * 6) * 0.55 + d;
    return pick(skyPalette, skyT);
  }

  /**
   * 5. Van Gogh — Sunflowers (1888)
   */
  function sunflowers(u, v, col, row) {
    const bgPalette = ['#d6ba6b', '#e2ca7d', '#ebd791', '#f2e3a7', '#f7ecc0'];
    const tablePalette = ['#b0822d', '#c2933a', '#d1a347', '#deb257'];
    const vasePalette = ['#9c6127', '#b57634', '#cc8d45', '#deaa5d', '#ebd086'];
    const petalPalette = ['#d48a17', '#e6a322', '#f2bd2e', '#f7d34d', '#fae278'];
    const centerPalette = ['#42230f', '#5e3416', '#7a451d', '#965828', '#ab6e35'];
    const stemPalette = ['#3f5729', '#526e36', '#678544', '#7e9c56'];

    const d = bayerDither(col, row, 0.2);

    const flowers = [
      [0.48, 0.24, 0.095],
      [0.33, 0.36, 0.088],
      [0.63, 0.35, 0.090],
      [0.47, 0.44, 0.098],
      [0.37, 0.53, 0.082],
      [0.59, 0.52, 0.085],
      [0.49, 0.58, 0.070],
    ];

    for (const [fx, fy, fr] of flowers) {
      const dx = (u - fx) * 1.45;
      const dy = v - fy;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const petalR = fr * (0.80 + Math.abs(Math.sin(angle * 8)) * 0.34);

      if (dist < fr * 0.42) {
        return pick(centerPalette, fbm(u * 30, v * 30) + d);
      }
      if (dist < petalR) {
        const ray = Math.abs(Math.sin(angle * 8)) * 0.35;
        return pick(petalPalette, (dist / petalR) * 0.65 + ray + d);
      }
    }

    // Stems & leaves
    if (v > 0.32 && v < 0.63 && Math.abs(u - 0.48) < 0.11) {
      const leafNoise = fbm(u * 26, v * 16);
      if (leafNoise > 0.52) {
        return pick(stemPalette, leafNoise + d);
      }
    }

    // Earthenware vase with impasto shading
    const vaseTop = 0.61;
    const vaseBot = 0.87;
    if (v >= vaseTop && v <= vaseBot) {
      const t = (v - vaseTop) / (vaseBot - vaseTop);
      const vaseHalfW = 0.065 + Math.sin(t * Math.PI) * 0.055;
      if (Math.abs(u - 0.49) < vaseHalfW) {
        const shade = (v < 0.74 ? 0.68 : 0.32) + (0.52 - u) * 1.8 + fbm(u * 18, v * 18) * 0.25 + d;
        return pick(vasePalette, shade);
      }
    }

    if (v > 0.82) {
      return pick(tablePalette, fbm(u * 12, v * 12) + d);
    }

    return pick(bgPalette, fbm(u * 10, v * 10) + d);
  }

  /**
   * 6. Michelangelo — The Creation of Adam (1512)
   */
  function creationOfAdam(u, v, col, row) {
    const plasterPalette = ['#bfb097', '#ccbea6', '#d9ccb6', '#e5dac7', '#ede4d5'];
    const earthPalette = ['#435234', '#556642', '#687a52', '#7d8f65', '#91a178'];
    const skinPalette = ['#a67154', '#ba8364', '#cf9a7a', '#deb092', '#ebc4aa'];
    const mantlePalette = ['#4d1c22', '#66262e', '#7d323b', '#96424c', '#ab545e'];
    const robePalette = ['#b0a3ab', '#c4b8bf', '#d6ccd2', '#e6dfe3'];

    const d = bayerDither(col, row, 0.2);

    // Spark between fingertips
    const sparkDist = Math.hypot((u - 0.50) * 1.45, v - 0.45);
    if (sparkDist < 0.036) {
      return sparkDist < 0.018 ? '#faf0c8' : '#edd58a';
    }

    // Left: Adam's arm & reclining body
    const adamArmY = 0.47 + (0.48 - u) * 0.16;
    if (u > 0.24 && u < 0.485 && Math.abs(v - adamArmY) < 0.028) {
      return pick(skinPalette, 0.5 + (adamArmY - v) * 10 + d);
    }
    if (u > 0.11 && u < 0.34 && v > 0.45 && v < 0.79) {
      const torsoDist = Math.hypot((u - 0.22) * 1.35, (v - 0.62) * 0.85);
      if (torsoDist < 0.14) {
        return pick(skinPalette, 0.45 + (0.65 - v) * 2.2 + fbm(u * 16, v * 16) * 0.25 + d);
      }
    }
    if (v > 0.66 + (u - 0.1) * 0.45 && u < 0.43) {
      return pick(earthPalette, fbm(u * 14, v * 14) + d);
    }

    // Right: God's outstretched arm, robe & billowing mantle
    const godArmY = 0.445 + (u - 0.515) * 0.05;
    if (u > 0.515 && u < 0.72 && Math.abs(v - godArmY) < 0.028) {
      return u < 0.58 ? pick(skinPalette, 0.6 + d) : pick(robePalette, 0.55 + d);
    }

    const mantleDist = Math.hypot((u - 0.76) * 0.95, (v - 0.46) * 1.15);
    if (mantleDist < 0.24 + (fbm(u * 12, v * 12) - 0.5) * 0.07) {
      if (u > 0.62 && u < 0.78 && v > 0.35 && v < 0.57) {
        return pick(robePalette, fbm(u * 16, v * 16) + d);
      }
      return pick(mantlePalette, fbm(u * 12, v * 12) + d);
    }

    // Crackled Sistine plaster sky
    return pick(plasterPalette, fbm(u * 9, v * 9) + d);
  }

  return {
    'water-lilies': {
      title: 'Monet: Water Lilies',
      sample: waterLilies,
    },
    'impression-sunrise': {
      title: 'Monet: Impression, Sunrise',
      sample: impressionSunrise,
    },
    'starry-night': {
      title: 'Van Gogh: The Starry Night',
      sample: starryNight,
    },
    'great-wave': {
      title: 'Hokusai: The Great Wave',
      sample: greatWave,
    },
    'sunflowers': {
      title: 'Van Gogh: Sunflowers',
      sample: sunflowers,
    },
    'creation-of-adam': {
      title: 'Michelangelo: Creation of Adam',
      sample: creationOfAdam,
    },
  };
})();
