# SilhouType

Place text along the curves of an uploaded image, then export as SVG (transparent background) or a 1 mm thick STL.

**Live demo:** enable GitHub Pages on this repo and open the published URL.

## Features

- Upload any image (PNG, JPG, SVG, etc.)
- **Auto Trace** — detects the dominant silhouette edge automatically
- **Manual Trace** — click to place points; path is smoothed with a spline
- **Flip** — toggle text right-side up or upside down along the path
- Built-in fonts or upload your own `.ttf` / `.otf` / `.woff`
- Font size, weight, italic, letter spacing, and outline controls
- **Export SVG** — text only, transparent background
- **Export STL** — 1 mm extruded mesh for 3D printing

## Run locally

No build step required. Serve the folder with any static server:

```bash
npx serve .
# or
python -m http.server 8080
```

Then open `http://localhost:8080` (or the port shown).

> ES modules and font fetching require a local server — opening `index.html` directly from disk may block module loading.

## GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Set source to **Deploy from branch**, branch **main**, folder **/ (root)**.
4. Save. The site will be available at `https://<username>.github.io/<repo>/`.

The included `.nojekyll` file ensures GitHub Pages serves the app as-is.

## Usage

1. Upload an image.
2. Click **Auto Trace** (or **Manual Trace** and click along the desired curve, then **Finish Path**).
3. Enter your text and adjust font settings.
4. Use **Flip Text** if the text reads upside down.
5. **Export SVG** or **Export STL**.

## Tech

- Vanilla HTML / CSS / JavaScript (ES modules)
- [opentype.js](https://github.com/opentypejs/opentype.js) for font parsing and glyph paths
- [earcut](https://github.com/mapbox/earcut) for STL triangulation
- [@fontsource](https://fontsource.org/) CDN for bundled fonts

## License

MIT
