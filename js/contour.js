/** Auto-detect contours from an image; pick by clicking a line or shape. */

import { catmullRomSpline, simplifyPoints, dist } from './path.js';

export function prepareAutoTraceIndex(imageData, width, height) {
  const gray = toGrayscale(imageData);
  const threshold = otsuThreshold(gray);
  const darkMask = gray.map((v) => (v < threshold ? 1 : 0));
  const lightMask = gray.map((v) => (v >= threshold ? 1 : 0));
  const contours = [
    ...findAllContours(darkMask, width, height),
    ...findAllContours(lightMask, width, height),
  ];

  return {
    contours,
    pickNearest(x, y) {
      return pickNearestContour(contours, x, y);
    },
  };
}

export function autoTraceAtPoint(imageData, width, height, clickX, clickY) {
  const gray = toGrayscale(imageData);
  const threshold = otsuThreshold(gray);
  const cx = Math.max(0, Math.min(width - 1, Math.round(clickX)));
  const cy = Math.max(0, Math.min(height - 1, Math.round(clickY)));

  const darkMask = gray.map((v) => (v < threshold ? 1 : 0));
  const lightMask = gray.map((v) => (v >= threshold ? 1 : 0));
  const pixelDark = gray[cy * width + cx] < threshold;

  let boundary = traceComponentBoundary(pixelDark ? darkMask : lightMask, width, height, cx, cy);
  if (boundary.length < 8) {
    boundary = traceComponentBoundary(pixelDark ? lightMask : darkMask, width, height, cx, cy);
  }
  if (boundary.length < 8) {
    const all = [
      ...findAllContours(darkMask, width, height),
      ...findAllContours(lightMask, width, height),
    ];
    boundary = pickNearestContour(all, clickX, clickY) ?? [];
  }

  return finishContour(boundary);
}

/** @deprecated Use autoTraceAtPoint after user click. */
export function autoTraceContour(imageData, width, height) {
  const gray = toGrayscale(imageData);
  const threshold = otsuThreshold(gray);
  const darkMask = gray.map((v) => (v < threshold ? 1 : 0));
  const lightMask = gray.map((v) => (v >= threshold ? 1 : 0));
  const darkBoundary = traceOuterBoundary(darkMask, width, height);
  const lightBoundary = traceOuterBoundary(lightMask, width, height);
  const boundary = pickBestBoundary(darkBoundary, lightBoundary, width, height);
  return finishContour(boundary);
}

function finishContour(boundary) {
  if (!boundary || boundary.length < 8) return null;
  const simplified = simplifyPoints(boundary, 3);
  const smoothed = catmullRomSpline(simplified, 8, false);
  return smoothed.length >= 2 ? smoothed : null;
}

function traceComponentBoundary(mask, width, height, sx, sy) {
  let x = sx;
  let y = sy;

  if (mask[y * width + x] !== 1) {
    const nearest = findNearestForeground(mask, width, height, sx, sy, 40);
    if (!nearest) return [];
    x = nearest.x;
    y = nearest.y;
  }

  const componentMask = new Uint8Array(width * height);
  floodFillComponent(mask, componentMask, x, y, width, height);
  return traceOuterBoundary(componentMask, width, height);
}

function findAllContours(mask, width, height) {
  const visited = new Uint8Array(width * height);
  const contours = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] !== 1 || visited[idx]) continue;

      const componentMask = new Uint8Array(width * height);
      floodFillComponent(mask, componentMask, x, y, width, height, visited);
      const area = componentMask.reduce((sum, v) => sum + v, 0);
      if (area < 24) continue;

      const boundary = traceOuterBoundary(componentMask, width, height);
      if (boundary.length >= 8) contours.push(boundary);
    }
  }

  return contours;
}

function pickNearestContour(contours, x, y) {
  if (contours.length === 0) return null;
  let best = null;
  let bestDist = Infinity;

  for (const contour of contours) {
    const d = distanceToContour(x, y, contour);
    if (d < bestDist) {
      bestDist = d;
      best = contour;
    }
  }

  return best;
}

function distanceToContour(x, y, contour) {
  let min = Infinity;
  for (let i = 0; i < contour.length - 1; i++) {
    min = Math.min(min, distToSegment(x, y, contour[i], contour[i + 1]));
  }
  return min;
}

function distToSegment(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist({ x: px, y: py }, a);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return dist(
    { x: px, y: py },
    { x: a.x + t * dx, y: a.y + t * dy },
  );
}

function findNearestForeground(mask, width, height, sx, sy, maxRadius) {
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = sx + dx;
        const y = sy + dy;
        if (x >= 0 && x < width && y >= 0 && y < height && mask[y * width + x] === 1) {
          return { x, y };
        }
      }
    }
  }
  return null;
}

function floodFillComponent(source, dest, sx, sy, width, height, visited = null) {
  const stack = [[sx, sy]];
  const startIdx = sy * width + sx;

  if (source[startIdx] !== 1) return;

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    const idx = y * width + x;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (source[idx] !== 1 || dest[idx] === 1) continue;

    dest[idx] = 1;
    if (visited) visited[idx] = 1;

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
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
