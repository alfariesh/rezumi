# Vendored Forme

Rezumi renders PDFs with [Forme](https://github.com/formepdf/forme) (MIT). Until upstream ships the fixes below, every
surface runs Forme **0.29.0 with Rezumi's patches** instead of the published packages:

| Where                           | What                                                                                 | How it is wired                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Web, server, Cloudflare Worker  | `vendor/formepdf-core`: the published `@formepdf/core` 0.29.0 with a rebuilt engine  | `overrides` → `file:vendor/formepdf-core` in `pnpm-workspace.yaml` |
| Mobile (native engine)          | `packages/forme-native/rust/vendor/forme-pdf`: the `forme-pdf` 0.29.0 crate, patched | `[patch.crates-io]` in `packages/forme-native/rust/Cargo.toml`     |
| Style serialiser (all surfaces) | `patches/@formepdf__shared@0.29.0.patch`: passes `zIndex` through `mapStyle`         | `patchedDependencies` in `pnpm-workspace.yaml`                     |

Only `pkg/`, `pkg-web/` and `pkg-node/forme_bg.wasm` differ from the published `@formepdf/core`; its JavaScript, types
and the wasm-bindgen glue are the published files. The three engine files are identical, so git stores one.

## The patches

All in `packages/forme-native/rust/vendor/forme-pdf/src`, with tests beside the existing absolute-positioning tests in
`layout/mod.rs`:

1. **An auto-height absolute box stretches between `top` and `bottom`** (`layout_children`), as CSS sizes it. Forme
   stretched the width between `left` and `right` but measured the height from the content, so an empty rule (Jejak's
   timeline line) had no height and was never drawn.
2. **A percentage height on an absolute box resolves against the containing block's height.** Forme read `50%` as 50pt.
3. **`zIndex`** (`style/mod.rs`, read as a whole number): absolute children paint in z-index order, and a negative one
   paints beneath the containing block's in-flow content. Absolute boxes used to paint over everything, so the line
   crossed Jejak's dots.
4. **`row-reverse`** (`layout_flex_row`): each line is placed from the main-end as CSS does (laid out as a row, then
   mirrored, which mirrors `justify-content` too), while the children lay out and paint in tree order. Forme laid
   `row-reverse` out as `row`, so `to-forme.tsx` reversed the children, and the PDF's reading order followed the page
   from left to right: Kirana's sidebar was read before the name. The adapter now passes `row-reverse` through.

The vendored crate's manifest drops the crate's tests, examples, CLI and `rcgen` dev-dependency, which need files the
copy leaves out; its `Cargo.lock` lost only `rcgen`'s tree.

Checked over the 16 templates with the sample, their presets, Indonesian, Arabic and the sidebar flipped. Patches 1–3
change none of them today: Jejak's timeline line (`top`/`bottom`, `zIndex: -1`) reaches the PDF as the border of a box
around its entries (`barAsBorder` in `packages/pdf/src/forme/to-forme.tsx`), which Forme draws on every page the list
reaches, where an absolute box appears only on the first. Patch 4 keeps every box where it was except in right-to-left
pages, where a wrapping row now fills its lines from the start and puts each contact's icon before its text, as the
web page always did; it is what lets a template's reading order follow its source (Phase 07's two-column order).

## Rebuilding the engine

After changing the crate:

```sh
rustup target add wasm32-unknown-unknown --toolchain 1.95.0
cargo install wasm-bindgen-cli --version 0.2.108 --locked
brew install binaryen
bash tooling/forme/build-wasm.sh
```

The script builds with the toolchain pinned in `packages/forme-native/rust/rust-toolchain.toml` and the wasm-bindgen
version in the crate's `Cargo.lock`, the same way upstream's `wasm-pack` build does. The glue it writes must match the
committed files; only the engine changes. To check a toolchain, build the unpatched sources: the PDFs it renders match
the published engine byte for byte.

A change under `packages/forme-native/rust/` changes the native fingerprint: the mobile app needs a new store build
(`CLAUDE.md` → Native mobile app). Regenerate the notices too: `node packages/forme-native/scripts/notices.mjs`.

## Dropping the fork

Reported upstream as [danmolitor/forme#234](https://github.com/danmolitor/forme/issues/234). When a Forme release
includes these fixes: set `@formepdf/*` and `forme-pdf` to that version, remove the override,
the `[patch.crates-io]` entry, the `@formepdf/shared` patch, this folder and `packages/forme-native/rust/vendor`, then
check that Jejak still draws its line beneath the dots.
