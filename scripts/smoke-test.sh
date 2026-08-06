#!/usr/bin/env bash
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
index="$root/index.html"
grep --quiet --fixed-strings "<!doctype html>" "$index"
echo "doctype declaration found"
grep --quiet --fixed-strings "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />" "$index"
echo "meta tag for responsive device width and scale found"
grep --quiet --fixed-strings "<meta charset=\"utf-8\" />" "$index"
echo "meta tag for utf-8 character set found"
echo "all tests passing"
