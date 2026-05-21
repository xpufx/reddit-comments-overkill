# Website

**overkill.uppidi.com** is the GitHub Pages site for this project. It's auto-generated from the README on every push.

## How it works

Three files build the site:

| File | What it does |
|------|-------------|
| `src/template.html` | HTML layout with CSS theme, nav bar (logo + GitHub + install icons), and "Other Projects" footer |
| `src/build.js` | Reads `README.md` → converts to HTML via `marked` → strips the H1 (nav bar has the title) → injects into template → copies images to `docs/` |
| `.github/workflows/pages.yml` | GitHub Action triggered on pushes to `README.md`, template, or build script — runs `build.js` and deploys `docs/` to Pages |

## To update the site

Edit `README.md` and push. The Action does the rest.

## To change the look

Edit `src/template.html`. The CSS is inlined in the `<style>` tag.
