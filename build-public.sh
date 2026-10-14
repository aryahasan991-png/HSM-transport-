#!/usr/bin/env bash

set -euo pipefail

echo "=================================="
echo "BUILD HSM TRANSPORT - PENUMPANG"
echo "PT HIDAYAH SARANA MULIA"
echo "=================================="

# Folder hasil build
OUTPUT="public-dist"

rm -rf "$OUTPUT"
mkdir -p "$OUTPUT"

# ==================================
# HALAMAN WEBSITE PENUMPANG
# ==================================

cp index.html "$OUTPUT/index.html"

# Halaman tiket penumpang
if [ -f tiket.html ]; then
  cp tiket.html "$OUTPUT/tiket.html"
fi

# ==================================
# FILE PENDUKUNG WEBSITE
# ==================================

find . -maxdepth 1 -type f \
  \( \
    -iname '*.js' -o \
    -iname '*.css' -o \
    -iname '*.png' -o \
    -iname '*.jpg' -o \
    -iname '*.jpeg' -o \
    -iname '*.webp' -o \
    -iname '*.svg' -o \
    -iname '*.ico' -o \
    -iname '*.wav' -o \
    -iname '*.woff' -o \
    -iname '*.woff2' \
  \) \
  ! -iname '*admin*.js' \
  ! -iname '*staff*.js' \
  ! -iname '*trip*.js' \
  ! -iname '*manifest*.js' \
  ! -iname 'hsm-pwa-menu.js' \
  -exec cp {} "$OUTPUT/" \;

# ==================================
# FILE PWA PENUMPANG
# ==================================

for file in \
  manifest.webmanifest \
  sw.js \
  robots.txt \
  sitemap.xml
do
  if [ -f "$file" ]; then
    cp "$file" "$OUTPUT/$file"
  fi
done

# ==================================
# VALIDASI FILE PENTING
# ==================================

for file in \
  index.html \
  config.js \
  app.js \
  hsm-site-public.js \
  hsm-logo.png
do
  if [ ! -s "$OUTPUT/$file" ]; then
    echo "ERROR: File tidak tersedia: $file"
    exit 1
  fi
done

# ==================================
# PASTIKAN FILE INTERNAL TIDAK ADA
# ==================================

rm -f \
  "$OUTPUT/admin.html" \
  "$OUTPUT/petugas.html" \
  "$OUTPUT/portal.html" \
  "$OUTPUT/hsm-pwa-menu.js"

echo "=================================="
echo "WEBSITE PENUMPANG BERHASIL DISIAPKAN"
echo "=================================="

ls -lh "$OUTPUT"
