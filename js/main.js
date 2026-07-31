import { autoTraceContour } from './contour.js';
import { loadFont, loadFontFromFile } from './fonts.js';
import { catmullRomSpline, pointsToSvgPath } from './path.js';
import { layoutTextOnPath, glyphsToSvgElements } from './textPath.js';
import { exportSvg, exportStl, downloadBlob } from './export.js';
import { initTextInput, getTextValue } from './textInput.js';

const state = {
  image: null,
  imageUrl: null,
  canvasW: 0,
  canvasH: 0,
  rawPoints: [],
  pathPoints: null,
  mode: null,
  font: null,
  fontKey: 'Bebas Neue-400',
  customFontKey: null,
  glyphs: [],
  flipped: false,
  text: 'SilhouType',
};

const els = {
  canvas: document.getElementById('mainCanvas'),
  overlay: document.getElementById('textOverlay'),
  canvasWrap: document.getElementById('canvasWrap'),
  emptyState: document.getElementById('emptyState'),
  imageInput: document.getElementById('imageInput'),
  fontInput: document.getElementById('fontInput'),
  fontSelect: document.getElementById('fontSelect'),
  textInput: document.getElementById('textInput'),
  fontSize: document.getElementById('fontSize'),
  fontSizeOut: document.getElementById('fontSizeOut'),
  fontWeight: document.getElementById('fontWeight'),
  fontItalic: document.getElementById('fontItalic'),
  letterSpacing: document.getElementById('letterSpacing'),
  letterSpacingOut: document.getElementById('letterSpacingOut'),
  outlineWidth: document.getElementById('outlineWidth'),
  outlineWidthOut: document.getElementById('outlineWidthOut'),
  autoTraceBtn: document.getElementById('autoTraceBtn'),
  manualTraceBtn: document.getElementById('manualTraceBtn'),
  finishTraceBtn: document.getElementById('finishTraceBtn'),
  undoPointBtn: document.getElementById('undoPointBtn'),
  clearPathBtn: document.getElementById('clearPathBtn'),
  manualControls: document.getElementById('manualControls'),
  traceHint: document.getElementById('traceHint'),
  flipBtn: document.getElementById('flipBtn'),
  exportSvgBtn: document.getElementById('exportSvgBtn'),
  exportStlBtn: document.getElementById('exportStlBtn'),
  startOverBtn: document.getElementById('startOverBtn'),
  customFontLabel: document.getElementById('customFontLabel'),
  uploadStatus: document.getElementById('uploadStatus'),
  workspace: document.querySelector('.workspace'),
};

const ctx = els.canvas.getContext('2d');
let previewTimer = null;

init();

function init() {
  els.textInput.value = 'SilhouType';
  initTextInput(els.textInput, {
    onChange: (value) => {
      state.text = value;
      schedulePreview();
    },
  });
  bindEvents();
  loadFont('Bebas Neue', 400).then((font) => {
    state.font = font;
    if (state.pathPoints) renderPreview();
  }).catch(console.error);
}

function bindEvents() {
  els.imageInput.addEventListener('click', () => {
    els.imageInput.value = '';
  });
  els.imageInput.addEventListener('change', onImageUpload);
  els.fontInput.addEventListener('change', onFontUpload);
  els.fontSelect.addEventListener('change', onFontChange);
  els.textInput.addEventListener('blur', renderPreview);
  els.fontSize.addEventListener('input', () => {
    els.fontSizeOut.value = els.fontSize.value;
    schedulePreview();
  });
  els.fontWeight.addEventListener('change', onFontChange);
  els.fontItalic.addEventListener('change', schedulePreview);
  els.letterSpacing.addEventListener('input', () => {
    els.letterSpacingOut.value = els.letterSpacing.value;
    schedulePreview();
  });
  els.outlineWidth.addEventListener('input', () => {
    els.outlineWidthOut.value = els.outlineWidth.value;
    schedulePreview();
  });

  els.autoTraceBtn.addEventListener('click', runAutoTrace);
  els.manualTraceBtn.addEventListener('click', startManualTrace);
  els.finishTraceBtn.addEventListener('click', finishManualTrace);
  els.undoPointBtn.addEventListener('click', undoPoint);
  els.clearPathBtn.addEventListener('click', clearPath);
  els.flipBtn.addEventListener('click', toggleFlip);
  els.exportSvgBtn.addEventListener('click', onExportSvg);
  els.exportStlBtn.addEventListener('click', onExportStl);
  els.startOverBtn.addEventListener('click', startOver);

  els.canvas.addEventListener('click', onCanvasClick);
  els.canvas.addEventListener('mousemove', onCanvasMove);
}

function onImageUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  setUploadStatus(`Loading ${file.name}…`);

  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = URL.createObjectURL(file);

  const img = new Image();
  img.onload = () => {
    if (!img.width || !img.height) {
      setUploadStatus('Could not read image dimensions. Try a PNG or JPG.', true);
      URL.revokeObjectURL(state.imageUrl);
      state.imageUrl = null;
      return;
    }

    state.image = img;
    fitCanvasToImage(img);
    state.rawPoints = [];
    state.pathPoints = null;
    state.mode = null;
    els.manualControls.classList.add('hidden');
    els.traceHint.textContent = 'Use Auto Trace or Manual Trace to define a path.';
    updateButtonStates();
    els.emptyState.classList.add('hidden');
    els.canvasWrap.classList.add('has-image');
    redraw();
    setUploadStatus(`Loaded ${file.name}`, false, true);
  };
  img.onerror = () => {
    setUploadStatus('Could not load that image. Try PNG, JPG, or WebP.', true);
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    state.imageUrl = null;
    els.imageInput.value = '';
  };
  img.src = state.imageUrl;
}

function setUploadStatus(message, isError = false, isSuccess = false) {
  els.uploadStatus.textContent = message;
  els.uploadStatus.classList.remove('hidden', 'error', 'success');
  if (isError) els.uploadStatus.classList.add('error');
  if (isSuccess) els.uploadStatus.classList.add('success');
}

function fitCanvasToImage(img) {
  const workspaceW = els.workspace?.clientWidth ?? window.innerWidth;
  const maxW = Math.max(200, Math.min(workspaceW - 32, 1200));
  const maxH = Math.max(200, window.innerHeight - 140);
  let w = img.width;
  let h = img.height;
  const scale = Math.min(1, maxW / w, maxH / h);
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));

  els.canvas.width = w;
  els.canvas.height = h;
  els.overlay.setAttribute('viewBox', `0 0 ${w} ${h}`);
  els.overlay.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  state.canvasW = w;
  state.canvasH = h;
}

function getPreviewPathPoints() {
  if (state.pathPoints && state.pathPoints.length >= 2) {
    return state.pathPoints;
  }
  if (state.mode === 'manual' && state.rawPoints.length >= 2) {
    return catmullRomSpline(state.rawPoints, 12, false);
  }
  return null;
}

function runAutoTrace() {
  if (!state.image) return;
  els.traceHint.textContent = 'Tracing silhouette…';

  ctx.drawImage(state.image, 0, 0, state.canvasW, state.canvasH);
  const imageData = ctx.getImageData(0, 0, state.canvasW, state.canvasH);
  const contour = autoTraceContour(imageData.data, state.canvasW, state.canvasH);

  state.mode = null;
  els.manualControls.classList.add('hidden');

  if (!contour) {
    els.traceHint.textContent = 'Auto trace failed — try Manual Trace instead.';
    return;
  }

  state.pathPoints = contour;
  state.rawPoints = [];
  els.traceHint.textContent = 'Path detected. Edit text and export when ready.';
  updateButtonStates();
  redraw();
  renderPreview();
}

function startManualTrace() {
  if (!state.image) return;
  state.mode = 'manual';
  state.rawPoints = [];
  state.pathPoints = null;
  els.manualControls.classList.remove('hidden');
  els.traceHint.textContent = 'Click to add points along the curve. Text preview updates as you go.';
  updateButtonStates();
  redraw();
  renderPreview();
}

function finishManualTrace() {
  if (state.rawPoints.length < 2) {
    els.traceHint.textContent = 'Add at least 2 points before finishing.';
    return;
  }
  state.pathPoints = catmullRomSpline(state.rawPoints, 12, false);
  state.mode = null;
  els.manualControls.classList.add('hidden');
  els.traceHint.textContent = 'Path created. Adjust text and export when ready.';
  updateButtonStates();
  redraw();
  renderPreview();
}

function undoPoint() {
  if (state.rawPoints.length === 0) return;
  state.rawPoints.pop();
  redraw();
  schedulePreview();
}

function clearPath() {
  state.rawPoints = [];
  state.pathPoints = null;
  updateButtonStates();
  redraw();
  renderPreview();
}

function onCanvasClick(e) {
  if (state.mode !== 'manual') return;
  const pt = canvasPointFromEvent(e);
  state.rawPoints.push(pt);
  redraw();
  schedulePreview();
}

function onCanvasMove(e) {
  if (state.mode !== 'manual') return;
  els.canvas.style.cursor = 'crosshair';
}

function canvasPointFromEvent(e) {
  const rect = els.canvas.getBoundingClientRect();
  const scaleX = els.canvas.width / rect.width;
  const scaleY = els.canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

function toggleFlip() {
  state.flipped = !state.flipped;
  els.flipBtn.textContent = state.flipped ? 'Flip Text (Upside Down)' : 'Flip Text (Right Side Up)';
  renderPreview();
}

async function onFontChange() {
  if (state.customFontKey) return;
  const name = els.fontSelect.value;
  const weight = parseInt(els.fontWeight.value, 10);
  try {
    state.font = await loadFont(name, weight);
    state.fontKey = `${name}-${weight}`;
    renderPreview();
  } catch (err) {
    console.error(err);
    els.traceHint.textContent = 'Could not load font. Try uploading one.';
  }
}

async function onFontUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  setUploadStatus(`Loading font ${file.name}…`);
  try {
    const { font, key } = await loadFontFromFile(file);
    state.font = font;
    state.customFontKey = key;
    state.fontKey = key;
    els.customFontLabel.textContent = `Using: ${file.name}`;
    els.customFontLabel.classList.remove('hidden');
    renderPreview();
    setUploadStatus(`Font loaded: ${file.name}`, false, true);
  } catch (err) {
    console.error(err);
    setUploadStatus('Invalid font file. Use .ttf, .otf, or .woff.', true);
    els.traceHint.textContent = 'Invalid font file.';
  }
}

function schedulePreview() {
  if (!getPreviewPathPoints()) return;
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    previewTimer = null;
    renderPreview();
  }, 150);
}

function renderPreview() {
  state.text = getTextValue(els.textInput);
  const pathPoints = getPreviewPathPoints();

  if (!state.font || !pathPoints) {
    if (els.overlay.childNodes.length > 0) {
      els.overlay.replaceChildren();
    }
    state.glyphs = [];
    updateButtonStates();
    return;
  }

  const result = layoutTextOnPath({
    font: state.font,
    text: state.text || ' ',
    pathPoints,
    fontSize: parseFloat(els.fontSize.value),
    letterSpacing: parseFloat(els.letterSpacing.value),
    flipped: state.flipped,
    outlineWidth: parseFloat(els.outlineWidth.value),
    italic: els.fontItalic.checked,
  });

  state.glyphs = result.glyphs;
  els.overlay.replaceChildren(
    glyphsToSvgElements(result.glyphs, parseFloat(els.outlineWidth.value), {
      fill: '#ffffff',
      stroke: 'none',
      previewStroke: '#111111',
    })
  );
  updateButtonStates();
}

function redraw() {
  ctx.clearRect(0, 0, state.canvasW, state.canvasH);
  if (state.image) {
    ctx.drawImage(state.image, 0, 0, state.canvasW, state.canvasH);
  }

  if (state.pathPoints && state.pathPoints.length > 1) {
    drawPath(state.pathPoints, '#6c8cff', 2);
  }

  if (state.mode === 'manual' && state.rawPoints.length > 0) {
    if (state.rawPoints.length > 1) {
      drawPath(state.rawPoints, 'rgba(108, 140, 255, 0.5)', 1.5, false);
    }
    for (const pt of state.rawPoints) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#6c8cff';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

function drawPath(points, color, width, smooth = true) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const pts = smooth && points.length > 2 ? catmullRomSpline(points, 8, false) : points;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.stroke();
}

function onExportSvg() {
  if (!state.glyphs.length) return;
  const svg = exportSvg(
    state.glyphs,
    state.canvasW,
    state.canvasH,
    parseFloat(els.outlineWidth.value)
  );
  downloadBlob(svg, 'silhoutype-text.svg', 'image/svg+xml');
}

function onExportStl() {
  if (!state.glyphs.length) return;
  try {
    const buffer = exportStl(state.glyphs);
    downloadBlob(buffer, 'silhoutype-text.stl', 'model/stl');
  } catch (err) {
    console.error(err);
    setUploadStatus(err.message || 'STL export failed.', true);
  }
}

function startOver() {
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  Object.assign(state, {
    image: null,
    imageUrl: null,
    canvasW: 0,
    canvasH: 0,
    rawPoints: [],
    pathPoints: null,
    mode: null,
    glyphs: [],
    flipped: false,
    customFontKey: null,
  });

  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  els.overlay.replaceChildren();
  els.emptyState.classList.remove('hidden');
  els.canvasWrap.classList.remove('has-image');
  els.uploadStatus.classList.add('hidden');
  els.uploadStatus.textContent = '';
  els.manualControls.classList.add('hidden');
  els.customFontLabel.classList.add('hidden');
  els.traceHint.textContent = 'Upload an image to begin tracing.';
  els.flipBtn.textContent = 'Flip Text';
  els.imageInput.value = '';
  els.fontInput.value = '';
  updateButtonStates();
}

function updateButtonStates() {
  const hasImage = !!state.image;
  const hasPath = !!getPreviewPathPoints();
  const canExport = hasPath && state.glyphs.length > 0;

  els.autoTraceBtn.disabled = !hasImage;
  els.manualTraceBtn.disabled = !hasImage;
  els.exportSvgBtn.disabled = !canExport;
  els.exportStlBtn.disabled = !canExport;
  els.flipBtn.disabled = !hasPath;
  els.startOverBtn.disabled = !hasImage;
}

if (location.search.includes('test=1')) {
  window.__silhoutypeTest = {
    setPath(points) {
      state.pathPoints = points;
      state.canvasW = 500;
      state.canvasH = 300;
      els.overlay.setAttribute('viewBox', '0 0 500 300');
      renderPreview();
    },
    setRawPoints(points) {
      state.mode = 'manual';
      state.rawPoints = points;
      state.pathPoints = null;
      state.canvasW = 500;
      state.canvasH = 300;
      els.overlay.setAttribute('viewBox', '0 0 500 300');
      els.manualControls.classList.remove('hidden');
      redraw();
      renderPreview();
    },
    setText(value) {
      els.textInput.value = value;
      state.text = value;
      renderPreview();
    },
    exportStlBytes() {
      const buffer = exportStl(state.glyphs);
      return Array.from(new Uint8Array(buffer));
    },
  };
}
