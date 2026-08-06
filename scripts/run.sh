#!/usr/bin/env bash
set -euo pipefail
root="${1:-$(git rev-parse --show-toplevel)}"
live-server "$root" -p "${PORT:-8080}"
