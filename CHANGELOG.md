# Changelog

## 0.2.0（待发布）

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
