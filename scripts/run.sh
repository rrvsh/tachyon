#!/usr/bin/env bash
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
live-server "$root" -p "${PORT:-8080}"
