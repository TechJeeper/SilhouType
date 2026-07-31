/** Path utilities: smoothing, sampling, arc-length parameterization. */

export function catmullRomSpline(points, segmentsPerSpan = 12, closed = false) {
  if (points.length < 2) return [...points];
  if (points.length === 2) return [...points];

  const result = [];
  const n = points.length;
  const count = closed ? n : n - 1;

  for (let i = 0; i < count; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    for (let t = 0; t < segmentsPerSpan; t++) {
      if (i > 0 || t > 0) {
        const u = t / segmentsPerSpan;
        result.push(catmullRomPoint(p0, p1, p2, p3, u));
      }
    }
  }

  if (!closed) {
    result.push({ ...points[n - 1] });
  } else if (result.length > 0) {
    result.push({ ...result[0] });
  }

  return result;
}

function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

export function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += dist(points[i - 1], points[i]);
  }
  return len;
}

export function pointAtDistance(points, distance) {
  if (points.length === 0) return null;
  if (points.length === 1) return { point: { ...points[0] }, angle: 0, index: 0 };

  let traveled = 0;
  for (let i = 1; i < points.length; i++) {
    const segLen = dist(points[i - 1], points[i]);
    if (traveled + segLen >= distance || i === points.length - 1) {
      const remain = distance - traveled;
      const t = segLen > 0 ? Math.min(1, Math.max(0, remain / segLen)) : 0;
      const x = points[i - 1].x + (points[i].x - points[i - 1].x) * t;
      const y = points[i - 1].y + (points[i].y - points[i - 1].y) * t;
      const angle = Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x);
      return { point: { x, y }, angle, index: i };
    }
    traveled += segLen;
  }

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return {
    point: { ...last },
    angle: Math.atan2(last.y - prev.y, last.x - prev.x),
    index: points.length - 1,
  };
}

export function pointsToSvgPath(points) {
  if (points.length === 0) return '';
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
  }
  return d;
}

export function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function simplifyPoints(points, tolerance = 2) {
  if (points.length <= 2) return points;
  return douglasPeucker(points, tolerance);
}

function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIndex), tolerance);
    return left.slice(0, -1).concat(right);
  }

  return [start, end];
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return dist(point, lineStart);
  return Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
}
