# Site tools

Helpers for the static site in `rti-growth-studio/`. Pages stay plain HTML that Render serves as-is; these tools just keep them consistent.

## `build.mjs`: run before every commit that touches the site

```sh
node tools/site/build.mjs           # update pages in place
node tools/site/build.mjs --check   # CI: fail if anything is out of date
```

- Writes `partials/header.html` and `partials/footer.html` into every public page, with paths adjusted for the page's folder depth. It also marks the current section in the menu with `aria-current`. To change the menu or footer, edit the partial, not the pages.
- Stamps every local CSS/JS link with `?v=<content hash>`, so browsers fetch a file again only when it really changed. Never edit `?v=` values by hand.

The CMS smoke workflow runs `--check`, so a forgotten build fails CI.

## `prune-css.py`: remove CSS that nothing uses

```sh
python tools/site/prune-css.py           # report only
python tools/site/prune-css.py --write   # rewrite the stylesheets
```

Drops rules whose class or id names appear in no page or script. Names inside `:not()`, `:is()`, `:where()` and `:has()` never cause removal. After `--write`, compare screenshots of every page before shipping. Class names built at runtime from string pieces are invisible to this check.

## Conventions

- **Square corners everywhere.** `aa-studio.css` enforces `border-radius: 0` site-wide.
- **Arrows:** `→` for links within the site, `↗` only for links that open another site.
- **Case studies:** copy `rti-growth-studio/work/case-study-template.html`. Its header comment lists the publishing steps.
