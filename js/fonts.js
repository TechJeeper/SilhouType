/** Font loading via Google Fonts fetch or user upload. */

const GOOGLE_FONT_URLS = {
  'Bebas Neue': 'https://cdn.jsdelivr.net/npm/@fontsource/bebas-neue@5.0.0/files/bebas-neue-latin-400-normal.woff',
  'Roboto': 'https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.0/files/roboto-latin-400-normal.woff',
  'Oswald': 'https://cdn.jsdelivr.net/npm/@fontsource/oswald@5.0.0/files/oswald-latin-400-normal.woff',
  'Playfair Display': 'https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5.0.0/files/playfair-display-latin-400-normal.woff',
  'Pacifico': 'https://cdn.jsdelivr.net/npm/@fontsource/pacifico@5.0.0/files/pacifico-latin-400-normal.woff',
  'Inter': 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.0/files/inter-latin-400-normal.woff',
};

const GOOGLE_FONT_BOLD = {
  'Roboto': 'https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.0/files/roboto-latin-700-normal.woff',
  'Oswald': 'https://cdn.jsdelivr.net/npm/@fontsource/oswald@5.0.0/files/oswald-latin-700-normal.woff',
  'Playfair Display': 'https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5.0.0/files/playfair-display-latin-700-normal.woff',
  'Inter': 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.0/files/inter-latin-700-normal.woff',
};

const cache = new Map();

export async function loadFont(name, weight = 400) {
  const key = `${name}-${weight}`;
  if (cache.has(key)) return cache.get(key);

  let url = GOOGLE_FONT_URLS[name];
  if (weight >= 700 && GOOGLE_FONT_BOLD[name]) {
    url = GOOGLE_FONT_BOLD[name];
  }
  if (!url) throw new Error(`Font "${name}" is not available.`);

  const font = await loadFromUrl(url);
  cache.set(key, font);
  return font;
}

export async function loadFontFromFile(file) {
  const buffer = await file.arrayBuffer();
  const font = opentype.parse(buffer);
  const key = `custom-${file.name}`;
  cache.set(key, font);
  return { font, key };
}

export function getCachedFont(key) {
  return cache.get(key);
}

async function loadFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load font from ${url}`);
  const buffer = await response.arrayBuffer();
  return opentype.parse(buffer);
}

export function listBuiltInFonts() {
  return Object.keys(GOOGLE_FONT_URLS);
}
