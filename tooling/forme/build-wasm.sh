#!/usr/bin/env bash
# Rebuilds the WebAssembly engine in vendor/formepdf-core from the patched Forme crate in
# packages/forme-native/rust/vendor/forme-pdf, the way upstream's wasm-pack build does (see vendor/README.md).
#
#   bash tooling/forme/build-wasm.sh
#
# Needs rustup with the toolchain pinned in packages/forme-native/rust/rust-toolchain.toml and its
# wasm32-unknown-unknown target, wasm-bindgen-cli at the version in the crate's Cargo.lock, and wasm-opt (binaryen).
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
rust="$root/packages/forme-native/rust"
crate="$rust/vendor/forme-pdf"
package="$root/vendor/formepdf-core"
# Under rust/target, which git and the native artifact hash both leave out.
target="$rust/target/wasm"
toolchain="$(sed -n 's/^channel = "\(.*\)"/\1/p' "$rust/rust-toolchain.toml")"
bindgen="$(awk '$0 == "name = \"wasm-bindgen\"" { getline; gsub(/"/, "", $3); print $3; exit }' "$crate/Cargo.lock")"

fail() {
	echo "$1" >&2
	exit 1
}
command -v wasm-bindgen >/dev/null || fail "Install wasm-bindgen: cargo install wasm-bindgen-cli --version $bindgen --locked"
[[ "$(wasm-bindgen --version)" == "wasm-bindgen $bindgen" ]] || fail "wasm-bindgen $bindgen is required, found: $(wasm-bindgen --version)"
command -v wasm-opt >/dev/null || fail "Install wasm-opt: brew install binaryen"
rustup target list --installed --toolchain "$toolchain" | grep -qx wasm32-unknown-unknown ||
	fail "Add the target: rustup target add wasm32-unknown-unknown --toolchain $toolchain"

# The toolchain's own directory goes first, so cargo finds its rustc whether or not rustup's proxies are installed.
bin="$(dirname "$(rustup which --toolchain "$toolchain" cargo)")"
(cd "$crate" && PATH="$bin:$PATH" CARGO_TARGET_DIR="$target" cargo build \
	--release --locked --lib --target wasm32-unknown-unknown --features wasm)

out="$(mktemp -d)"
trap 'rm -r "$out"' EXIT
# The three builds differ only in their JavaScript glue; the engine is the same file in each.
for build in bundler:pkg web:pkg-web nodejs:pkg-node; do
	directory="${build#*:}"
	wasm-bindgen "$target/wasm32-unknown-unknown/release/forme.wasm" \
		--out-dir "$out/$directory" --typescript --target "${build%%:*}" --out-name forme
	wasm-opt "$out/$directory/forme_bg.wasm" -o "$out/$directory/forme_bg.wasm" -O
	cp "$out/$directory"/* "$package/$directory/"
done

echo "Rebuilt $package. The glue should not change: git diff --stat -- vendor/formepdf-core"
