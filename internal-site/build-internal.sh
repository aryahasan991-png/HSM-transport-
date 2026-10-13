#!/usr/bin/env bash

set -euo pipefail

echo "=================================="
echo "BUILD HSM INTERNAL"
echo "PT HIDAYAH SARANA MULIA"
echo "=================================="

# Folder hasil build
OUTPUT="internal-dist"

rm -rf "$OUTPUT"

mkdir -p "$OUTPUT"

# ==================================
# HALAMAN KHUSUS HSM INTERNAL
# ==================================

cp internal-site/index.html \
  "$OUTPUT/index.html"

cp internal-site/manifest.webmanifest \
  "$OUTPUT/manifest.webmanifest"

cp internal-site/sw.js \
  "$OUTPUT/sw.js"

# ==================================
# HALAMAN ADMIN DAN PETUGAS
# ==================================

cp admin.html "$OUTPUT/admin.html"

cp petugas.html "$OUTPUT/petugas.html"

# ==================================
# FILE PENDUKUNG
# ==================================

# Salin aset statis dari folder utama.
# Tidak menyalin halaman booking penumpang.

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
  -exec cp {} "$OUTPUT/" \;

# ==================================
# VALIDASI
# ==================================

for file in \
  index.html \
  admin.html \
  petugas.html \
  manifest.webmanifest \
  sw.js \
  hsm-logo.png \
  hsm-apk-icon.png \
  hsm-pwa-audio.js \
  hsm_scan_success.wav \
  hsm_scan_error.wav
do

  if [ ! -s "$OUTPUT/$file" ]; then

    echo "ERROR: File tidak tersedia: $file"

    exit 1

  fi

done

echo "=================================="
echo "HSM INTERNAL BERHASIL DISIAPKAN"
echo "=================================="

ls -lh "$OUTPUT"
