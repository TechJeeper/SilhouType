/** Auto-detect the dominant silhouette contour from an image. */

import { catmullRomSpline, simplifyPoints } from './path.js';

export function autoTraceContour(imageData, width, height) {
  const gray = toGrayscale(imageData);
  const threshold = otsuThreshold(gray);

  const darkMask = gray.map((v) => (v < threshold ? 1 : 0));
  const lightMask = gray.map((v) => (v >= threshold ? 1 : 0));

  const darkBoundary = traceOuterBoundary(darkMask, width, height);
  const lightBoundary = traceOuterBoundary(lightMask, width, height);

  const boundary = pickBestBoundary(darkBoundary, lightBoundary, width, height);
  if (boundary.length < 8) return null;

  const simplified = simplifyPoints(boundary, 3);
  const smoothed = catmullRomSpline(simplified, 8, false);
  return smoothed.length >= 2 ? smoothed : null;
}

function pickBestBoundary(a, b, width, height) {
  if (a.length < 8) return b;
  if (b.length < 8) return a;

  const score = (pts) => {
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const span = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    const edgeDist = Math.min(
      Math.min(...xs),
      Math.min(...ys),
      width - Math.max(...xs),
      height - Math.max(...ys),
    );
    return span - edgeDist * width * 0.5;
  };

  return score(a) >= score(b) ? a : b;
}

function toGrayscale(data) {
  const gray = new Float32Array(data.length / 4);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }
  return gray;
}

function otsuThreshold(gray) {
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[Math.min(255, Math.max(0, Math.round(v)))]++;

  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) ** 2;
    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = t;
    }
  }

  return threshold;
}

function traceOuterBoundary(mask, width, height) {
  let startX = -1;
  let startY = -1;

  outer: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] === 1) {
        startX = x;
        startY = y;
        break outer;
      }
    }
  }

  if (startX < 0) return [];

  const dirs = [
    [1, 0], [1, 1], [0, 1], [-1, 1],
    [-1, 0], [-1, -1], [0, -1], [1, -1],
  ];

  const boundary = [];
  let x = startX;
  let y = startY;
  let dir = 7;
  const maxSteps = width * height * 4;
  let steps = 0;

  do {
    boundary.push({ x, y });
    let found = false;

    for (let i = 0; i < 8; i++) {
      const checkDir = (dir + i) % 8;
      const nx = x + dirs[checkDir][0];
      const ny = y + dirs[checkDir][1];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx] === 1) {
        x = nx;
        y = ny;
        dir = (checkDir + 6) % 8;
        found = true;
        break;
      }
    }

    if (!found) break;
    steps++;
  } while ((x !== startX || y !== startY || boundary.length < 4) && steps < maxSteps);

  if (boundary.length > 4000) {
    const step = Math.ceil(boundary.length / 4000);
    return boundary.filter((_, i) => i % step === 0);
  }

  return boundary;
}
