# Job board fixtures

Synthetic pages that imitate each board's structure, for the content script's tests. They are written by hand: no real
posting text, company or person is copied here (02-teknis.md §7.7). The structure follows the real pages checked on
2026-11-14 (02-teknis.md §18).

- `<board>/<state>.html`: the current interface per board and state (posting page, search page with a posting picked,
  search page with none, Indonesian or English interface, expired or closed posting, pay not stated).
- `generic/`: other sites (a career page with JSON-LD, one without, an empty app shell).
- The top-level `linkedin.html`, `indeed.html`, `jobstreet.html` and `glints.html` keep the older interfaces the
  readers still fall back to.
