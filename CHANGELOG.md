# Changelog

## 0.3.0 — 2026-11-10 (Pre-release)

### Added

- Opt-in article `cover_fit: contain` and `milo-screenshot` framing using theme colors; explicit cover/thumbnail selection remains unchanged.
- Hexo and Milo versions in the footer, generated at build time.

### Fixed

- Homepage excerpt HTML entities decode once before safe EJS escaping.
- Covers keep their rounded corners and intrinsic frame height instead of stretching with long excerpts.
- Navigation resize observation includes its border box, keeping mobile progress aligned when safe-area padding changes.

### Changed

- Homepage removes its visible heading but retains a meaningful, accessible hidden H1 with pagination context.
- Desktop covers align vertically with the article copy; mobile homepages use metadata, full-width title, one cover and excerpt in source order.
- Mobile covers use a 16:9 frame capped at 240px; contain images remain fully visible. Desktop proportions remain 5:3.
- At 800px and below, reading progress is a 3px line immediately below the measured sticky navigation; desktop progress and calculation remain unchanged.
- Expanded regression coverage for DOM order, accessibility, fit modes, real navigation height, safe areas, progress states and breakpoint boundaries.

### Validation and limits

- Node.js 26.13.0 / Hexo 8.1.2: syntax checks, 12 regression groups, root and /demo/ builds, and Chrome 156 full checks at 320/360/390/480/800/801/1280px in light/dark mode passed.
- Edge 157 startup timed out in this run; its page checks were not completed. Safari, Firefox and physical phones remain untested.
- Earlier intermittent TOC/return-to-top and scroll-restoration timeouts remain under observation; assertions were not loosened. This Chrome full matrix passed with diagnostic timeout reporting.

## 0.2.0

### Added

- Page-specific SEO metadata, Open Graph and Twitter Cards, with absolute sharing-image URLs and a bundled default image.
- Dependency-free Atom feed generation and feed discovery, respecting an existing site feed generator.
- Generated 404 page with home/search links, responsive layout and light/dark appearance.
- Collapsible mobile table of contents, reading progress, code-copy controls and optional native image lightbox.
- Safe title/excerpt keyword highlighting for Chinese, English and literal special characters.
- Configurable CSS sticky sidebar for recent posts and categories, leaving the author card in normal flow.
- Automated Hexo root/subdirectory builds, browser regression checks and dependency lockfile.

### Fixed

- Canonical/Disqus URL handling and full article counts on paginated archive/taxonomy pages.
- Missing tag/about navigation and appearance-menu keyboard/focus behavior.
- Duplicate search controls and unbroken-text overflow in home/search excerpts.
- Mobile table-of-contents wrapping and active-heading rounding; native clipboard fallback and lightbox focus containment.
- Image layout reservation, first-image loading priority and conditional reading-script loading.
- Explicit build-time dependencies on hexo-util and image-size.

### Changed

- Refined reading typography; mobile progress uses a safe-area-aware 3px bottom bar while desktop progress remains unchanged.
- Documented native pagination, unpaginated archive configuration and independent local preview workflow.
- Validated on Node.js 26.13.0 / Hexo 8.1.2; other runtime/browser combinations remain outside this validation.

## 0.1.0

- Initial independent Hexo theme, authored from scratch.
- Responsive layouts, system-aware appearance, local search and tracked table of contents.
- Standard Hexo archive, taxonomy and pagination support.
- Comments load only on reader request.
