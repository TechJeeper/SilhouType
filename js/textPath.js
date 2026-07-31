/** Render text along a smoothed path using opentype.js glyph paths. */

import { pathLength, pointAtDistance } from './path.js';

export function layoutTextOnPath(options) {
  const {
    font,
    text,
    pathPoints,
    fontSize,
    letterSpacing = 0,
    flipped = false,
    outlineWidth = 0,
    italic = false,
  } = options;

  if (!font || !text || !pathPoints || pathPoints.length < 2) {
    return { glyphs: [], totalWidth: 0, pathLength: 0 };
  }

  const scale = fontSize / font.unitsPerEm;
  const glyphs = [];
  let totalAdvance = 0;
  const advances = [];

  for (const char of text) {
    const g = font.charToGlyph(char);
    const advance = (g.advanceWidth ?? font.unitsPerEm * 0.5) * scale + letterSpacing;
    advances.push({ char, glyph: g, advance });
    totalAdvance += advance;
  }

  const totalPathLen = pathLength(pathPoints);
  if (totalAdvance <= 0 || totalPathLen <= 0) {
    return { glyphs: [], totalWidth: 0, pathLength: totalPathLen };
  }

  let offset = Math.max(0, (totalPathLen - totalAdvance) / 2);

  for (const { char, glyph, advance } of advances) {
    const { point, angle } = pointAtDistance(pathPoints, offset);
    const glyphPath = glyph.getPath(0, 0, fontSize);
    const pathData = glyphPath.toPathData(2);

    glyphs.push({
      char,
      pathData,
      commands: glyphPath.commands.map((cmd) => ({ ...cmd })),
      x: point.x,
      y: point.y,
      rotation: angle,
      flipped,
      advance,
      italic,
    });

    offset += advance;
  }

  return { glyphs, totalWidth: totalAdvance, pathLength: totalPathLen, outlineWidth };
}

function buildTransform(g) {
  const deg = (g.rotation * 180 / Math.PI).toFixed(2);
  let t = `translate(${g.x.toFixed(2)} ${g.y.toFixed(2)}) rotate(${deg})`;
  if (g.flipped) t += ' scale(1,-1)';
  if (g.italic) t += ' skewX(-12)';
  return t;
}

export function glyphsToSvgElements(glyphs, outlineWidth = 0, style = {}) {
  const fill = style.fill ?? '#000000';
  const stroke = style.stroke ?? 'none';
  const previewStroke = style.previewStroke;
  const root = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  if (previewStroke) {
    const halo = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    halo.setAttribute('fill', 'none');
    halo.setAttribute('stroke', previewStroke);
    halo.setAttribute('stroke-width', '3');
    halo.setAttribute('stroke-linejoin', 'round');
    halo.setAttribute('stroke-linecap', 'round');
    for (const g of glyphs) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', g.pathData);
      path.setAttribute('transform', buildTransform(g));
      halo.appendChild(path);
    }
    root.appendChild(halo);
  }

  if (outlineWidth > 0) {
    const strokeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    strokeGroup.setAttribute('fill', 'none');
    strokeGroup.setAttribute('stroke', stroke === 'none' ? '#000000' : stroke);
    strokeGroup.setAttribute('stroke-linejoin', 'round');
    strokeGroup.setAttribute('stroke-linecap', 'round');

    for (const g of glyphs) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', g.pathData);
      path.setAttribute('transform', buildTransform(g));
      path.setAttribute('stroke-width', String(outlineWidth * 2));
      strokeGroup.appendChild(path);
    }
    root.appendChild(strokeGroup);
  }

  const fillGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  fillGroup.setAttribute('fill', fill);
  fillGroup.setAttribute('stroke', stroke);

  for (const g of glyphs) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', g.pathData);
    path.setAttribute('transform', buildTransform(g));
    fillGroup.appendChild(path);
  }
  root.appendChild(fillGroup);

  return root;
}

export function glyphsToPathDataList(glyphs) {
  return glyphs.map((g) => {
    const cos = Math.cos(g.rotation);
    const sin = Math.sin(g.rotation);
    const skew = g.italic ? Math.tan(-12 * Math.PI / 180) : 0;
    return {
      pathData: g.pathData,
      transform: { x: g.x, y: g.y, cos, sin, skew, flipped: g.flipped },
    };
  });
}
