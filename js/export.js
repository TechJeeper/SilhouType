/** Export text as transparent SVG or 1 mm extruded STL. */

import { glyphsToPathDataList } from './textPath.js';

const PX_TO_MM = 25.4 / 96;
const EXTRUDE_MM = 1;
const MIN_TRIANGLE_AREA = 1e-8;

function triangulate(flat, holeIndices = []) {
  const fn = typeof earcut === 'function' ? earcut : earcut?.default;
  if (typeof fn !== 'function') {
    throw new Error('Triangulation library (earcut) is not loaded.');
  }
  return fn(flat, holeIndices);
}

export function exportSvg(glyphs, width, height, outlineWidth = 0) {
  const items = glyphsToPathDataList(glyphs);
  let paths = '';

  for (const item of items) {
    const matrix = transformToMatrix(item.transform);
    if (outlineWidth > 0) {
      paths += `<path d="${item.pathData}" transform="${matrix}" fill="none" stroke="#000000" stroke-width="${outlineWidth * 2}" stroke-linejoin="round" stroke-linecap="round"/>\n`;
    }
    paths += `<path d="${item.pathData}" transform="${matrix}" fill="#000000"/>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${paths}</svg>`;
}

function transformToMatrix(t) {
  const { x, y, cos, sin, skew = 0, flipped = false } = t;
  const flip = flipped ? -1 : 1;
  const a = cos - skew * sin * flip;
  const b = (sin + skew * cos) * flip;
  const c = -sin * flip;
  const d = cos * flip;
  return `matrix(${a.toFixed(6)} ${b.toFixed(6)} ${c.toFixed(6)} ${d.toFixed(6)} ${x.toFixed(4)} ${y.toFixed(4)})`;
}

export function exportStl(glyphs) {
  const scale = PX_TO_MM;
  const triangles = [];

  for (const glyph of glyphs) {
    if (!glyph.commands?.length) continue;
    const transform = {
      x: glyph.x,
      y: glyph.y,
      cos: Math.cos(glyph.rotation),
      sin: Math.sin(glyph.rotation),
      skew: glyph.italic ? Math.tan(-12 * Math.PI / 180) : 0,
      flipped: glyph.flipped,
    };
    const contours = flattenCommands(glyph.commands, transform, scale);
    const groups = groupContours(contours);
    for (const group of groups) {
      extrudeContourGroup(group, EXTRUDE_MM, triangles);
    }
  }

  const valid = triangles.filter(isValidTriangle);
  if (valid.length === 0) {
    throw new Error('No valid 3D geometry could be generated for STL export.');
  }

  return writeBinaryStl(valid, 'SilhouType');
}

function flattenCommands(commands, transform, scale) {
  const contours = [];
  let current = [];
  let pen = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };

  const addPoint = (x, y) => {
    current.push(transformPoint(x, y, transform, scale));
  };

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
        if (current.length >= 3) contours.push(closeContour(current));
        pen = { x: cmd.x, y: cmd.y };
        start = { x: cmd.x, y: cmd.y };
        current = [transformPoint(cmd.x, cmd.y, transform, scale)];
        break;
      case 'L':
        pen = { x: cmd.x, y: cmd.y };
        addPoint(cmd.x, cmd.y);
        break;
      case 'C':
        flattenCubic(pen, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 }, { x: cmd.x, y: cmd.y }, addPoint);
        pen = { x: cmd.x, y: cmd.y };
        break;
      case 'Q':
        flattenQuad(pen, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x, y: cmd.y }, addPoint);
        pen = { x: cmd.x, y: cmd.y };
        break;
      case 'Z':
        if (current.length >= 2) {
          current.push({ ...current[0] });
          contours.push(dedupeContour(current));
        }
        current = [];
        pen = { ...start };
        break;
      default:
        break;
    }
  }

  if (current.length >= 3) contours.push(closeContour(current));
  return contours.filter((c) => c.length >= 4);
}

function flattenCubic(p0, p1, p2, p3, emit) {
  const steps = Math.max(4, Math.ceil(dist(p0, p3) / 0.4));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    emit(
      u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
      u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y,
    );
  }
}

function flattenQuad(p0, p1, p2, emit) {
  const steps = Math.max(4, Math.ceil(dist(p0, p2) / 0.4));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    emit(
      u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    );
  }
}

function closeContour(points) {
  if (points.length === 0) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (dist(first, last) > 1e-6) return dedupeContour([...points, { ...first }]);
  return dedupeContour(points);
}

function dedupeContour(points) {
  const out = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev || dist(prev, p) > 1e-6) out.push(p);
  }
  if (out.length >= 2 && dist(out[0], out[out.length - 1]) < 1e-6) out.pop();
  if (out.length >= 3) out.push({ ...out[0] });
  return out;
}

function groupContours(contours) {
  const tagged = contours.map((points) => ({
    points,
    area: Math.abs(signedArea(points)),
  })).sort((a, b) => b.area - a.area);

  const groups = [];

  for (const contour of tagged) {
    let parent = null;
    for (const group of groups) {
      if (pointInPolygon(contour.points[0], group.outer)) {
        parent = group;
        break;
      }
    }
    if (parent) {
      parent.holes.push(contour.points);
    } else {
      groups.push({ outer: contour.points, holes: [] });
    }
  }

  return groups;
}

function extrudeContourGroup(group, height, triangles) {
  const outer = ensureWinding(group.outer, true);
  const holes = group.holes.map((h) => ensureWinding(h, false));
  const flat = [];
  const holeIndices = [];

  for (const p of outer) flat.push(p.x, p.y);
  for (const hole of holes) {
    holeIndices.push(flat.length / 2);
    for (const p of hole) flat.push(p.x, p.y);
  }

  let indices;
  try {
    indices = triangulate(flat, holeIndices);
  } catch {
    return;
  }
  if (!indices?.length) return;

  const points = [];
  for (let i = 0; i < flat.length; i += 2) {
    points.push({ x: flat[i], y: flat[i + 1] });
  }

  for (let i = 0; i < indices.length; i += 3) {
    const a = points[indices[i]];
    const b = points[indices[i + 1]];
    const c = points[indices[i + 2]];
    pushTri(triangles, a.x, a.y, 0, b.x, b.y, 0, c.x, c.y, 0);
    pushTri(triangles, c.x, c.y, height, b.x, b.y, height, a.x, a.y, height);
  }

  const edgeCount = new Map();
  const addEdge = (i, j) => {
    const key = i < j ? `${i},${j}` : `${j},${i}`;
    edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
  };

  for (let i = 0; i < indices.length; i += 3) {
    addEdge(indices[i], indices[i + 1]);
    addEdge(indices[i + 1], indices[i + 2]);
    addEdge(indices[i + 2], indices[i]);
  }

  for (const [key, count] of edgeCount) {
    if (count !== 1) continue;
    const [i, j] = key.split(',').map(Number);
    const a = points[i];
    const b = points[j];
    pushTri(triangles, a.x, a.y, 0, b.x, b.y, 0, b.x, b.y, height);
    pushTri(triangles, a.x, a.y, 0, b.x, b.y, height, a.x, a.y, height);
  }
}

function transformPoint(x, y, t, scale) {
  const { cos, sin, skew = 0, flipped = false } = t;
  const sx = x + skew * y;
  const sy = flipped ? -y : y;
  return {
    x: (t.x + cos * sx - sin * sy) * scale,
    y: -(t.y + sin * sx + cos * sy) * scale,
  };
}

function pushTri(out, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const ux = bx - ax;
  const uy = by - ay;
  const uz = bz - az;
  const vx = cx - ax;
  const vy = cy - ay;
  const vz = cz - az;
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-12) return;
  nx /= len;
  ny /= len;
  nz /= len;
  out.push({ nx, ny, nz, ax, ay, az, bx, by, bz, cx, cy, cz });
}

function isValidTriangle(t) {
  return [t.ax, t.ay, t.az, t.bx, t.by, t.bz, t.cx, t.cy, t.cz].every(Number.isFinite)
    && triangleArea(t) > MIN_TRIANGLE_AREA;
}

function triangleArea(t) {
  const ux = t.bx - t.ax;
  const uy = t.by - t.ay;
  const uz = t.bz - t.az;
  const vx = t.cx - t.ax;
  const vy = t.cy - t.ay;
  const vz = t.cz - t.az;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  return Math.hypot(nx, ny, nz) / 2;
}

function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    sum += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
  }
  return sum / 2;
}

function ensureWinding(points, ccw) {
  const area = signedArea(points);
  const isCcw = area > 0;
  if (isCcw === ccw) return points;
  return [...points].reverse();
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 2; i < polygon.length - 1; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function writeBinaryStl(triangles, name) {
  const buffer = new ArrayBuffer(84 + triangles.length * 50);
  const view = new DataView(buffer);

  for (let i = 0; i < 80; i++) view.setUint8(i, 0);
  const label = name.slice(0, 80);
  for (let i = 0; i < label.length; i++) view.setUint8(i, label.charCodeAt(i));

  view.setUint32(80, triangles.length, true);

  let offset = 84;
  for (const t of triangles) {
    view.setFloat32(offset, t.nx, true); offset += 4;
    view.setFloat32(offset, t.ny, true); offset += 4;
    view.setFloat32(offset, t.nz, true); offset += 4;
    view.setFloat32(offset, t.ax, true); offset += 4;
    view.setFloat32(offset, t.ay, true); offset += 4;
    view.setFloat32(offset, t.az, true); offset += 4;
    view.setFloat32(offset, t.bx, true); offset += 4;
    view.setFloat32(offset, t.by, true); offset += 4;
    view.setFloat32(offset, t.bz, true); offset += 4;
    view.setFloat32(offset, t.cx, true); offset += 4;
    view.setFloat32(offset, t.cy, true); offset += 4;
    view.setFloat32(offset, t.cz, true); offset += 4;
    view.setUint16(offset, 0, true); offset += 2;
  }

  return buffer;
}

export function validateBinaryStl(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 84) {
    return { ok: false, reason: 'File too small to be a binary STL.' };
  }
  const view = new DataView(buffer);
  const count = view.getUint32(80, true);
  if (buffer.byteLength !== 84 + count * 50) {
    return { ok: false, reason: `Triangle count mismatch (expected ${count}, size ${buffer.byteLength}).` };
  }
  if (count === 0) {
    return { ok: false, reason: 'STL contains zero triangles.' };
  }
  for (let i = 0; i < count; i++) {
    const off = 84 + i * 50;
    for (let j = 0; j < 12; j++) {
      const value = view.getFloat32(off + j * 4, true);
      if (!Number.isFinite(value)) {
        return { ok: false, reason: `Invalid coordinate at triangle ${i}.` };
      }
    }
  }
  return { ok: true, count };
}

export function downloadBlob(data, filename, mime) {
  const blob = data instanceof ArrayBuffer
    ? new Blob([data], { type: mime })
    : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
