#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p artifacts
cp README.md NOTICE.md LICENSE release/
(cd release && sha256sum myelin-arena-bridge myelin-openstrike > SHA256SUMS)
tar -czf artifacts/myelin-openstrike-linux-x86_64-v0.1.0.tar.gz -C release myelin-arena-bridge myelin-openstrike SHA256SUMS README.md NOTICE.md LICENSE
tar -czf artifacts/myelin-openstrike-web-v0.1.0.tar.gz web
