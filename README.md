# Cross-Stitch Personal Website

A lightweight, zero-dependency personal website featuring an interactive HTML5 Canvas cross-stitch embroidery background.

## Features
- **Procedural Aida Cloth**: Cached linen weave and pinhole grid with **Ecru** and **Midnight** fabric themes.
- **Two-Pass Cross-Stitch Rendering**: Stitches sew in sequentially (`/` then `\`) with subtle thread sheen, shadow, and organic jitter.
- **Interactive Embroidery**:
  - Hover over existing stitches to feel a gentle thread lift.
  - Click and drag anywhere in the margins to embroider in 6 DMC-inspired thread colors.
  - Switch between **Stitch** (freehand), **Motif** (rotating blossom, heart, and star stamps), and **Unpick** (eraser).
  - **Save** your custom tapestry as a PNG or **Replay Sampler** anytime.
- **Accessible & Lightweight**: Pure HTML, CSS, and Vanilla JS with `prefers-reduced-motion` support.

## Preview Locally
Open `index.html` directly in a browser, or run a simple local server from this directory:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
