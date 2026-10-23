#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
git submodule update --init vendor/open-strike
git -C vendor/open-strike submodule update --init vendor/pocketjs
cargo build --locked --release --features openstrike --bin myelin-arena-bridge
mkdir -p release
cp "${CARGO_TARGET_DIR:-target}/release/myelin-arena-bridge" release/
release/myelin-arena-bridge map > web/arena.json
cargo build --locked --manifest-path myelin/Cargo.toml
cp "${CARGO_TARGET_DIR:-myelin/target}/debug/myelin-openstrike" release/
npm ci --prefix service --no-audit --no-fund
npm ci --prefix web-src --no-audit --no-fund
npm run build --prefix web-src
