#!/bin/bash
# Buat video lengkap dari video/<nama>/naskah.json  →  video/<nama>/<nama>.mp4 + cover.jpg
# Pakai (dari folder repo): bash alat/buat-video.sh video/<nama>
set -e
DIR=${1%/}; NAMA=$(basename "$DIR")
cd "$(dirname "$0")/.."
python3 alat/suara.py "$DIR" ${SUARA_OPSI:-}
pgrep -f "http.server 8080" >/dev/null || (timeout 3600 python3 -m http.server 8080 >/dev/null 2>&1 &); sleep 1
node alat/render.js "$DIR"
python3 alat/audio.py "$DIR"
ffmpeg -v error -y -framerate 30 -i "$DIR/frames/f%05d.jpg" -i "$DIR/audio_final.wav" -c:v libx264 -preset medium -crf 19 \
  -pix_fmt yuv420p -profile:v high -movflags +faststart -c:a aac -b:a 192k -shortest "$DIR/SidoarjoVerse-$NAMA.mp4"
DUR=$(python3 -c "import json;print(json.load(open('$DIR/timeline.json'))['segmen'][1]['start']+1.2)")
ffmpeg -v error -y -ss "$DUR" -i "$DIR/SidoarjoVerse-$NAMA.mp4" -frames:v 1 -q:v 2 "$DIR/cover.jpg"
echo "SELESAI: $DIR/SidoarjoVerse-$NAMA.mp4"
