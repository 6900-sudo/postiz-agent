#!/usr/bin/env bash
# Assemble the NHS privatisation TikTok reel: 6 slides + 6 narration beats -> vertical MP4
set -uo pipefail
cd "$(dirname "$0")"

FFMPEG=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
mkdir -p build

dur() { "$FFMPEG" -i "$1" 2>&1 | grep -oP 'Duration: \K[0-9:.]+' | awk -F: '{print ($1*3600)+($2*60)+$3}'; }

LEAD=0.20   # silence before narration starts
TAIL=0.55   # hold after narration ends

for i in 1 2 3 4 5 6; do
  AD=$(dur "audio/seg$i.mp3")
  CLIP=$(python3 -c "print(round($LEAD + $AD + $TAIL, 3))")
  FOUT=$(python3 -c "print(round($CLIP - 0.35, 3))")
  echo "clip$i: audio=${AD}s clip=${CLIP}s"
  "$FFMPEG" -y -loop 1 -i "slides/slide$i.png" -i "audio/seg$i.mp3" \
    -filter_complex "\
[0:v]scale=1080:1920,fps=30,format=yuv420p,fade=t=in:st=0:d=0.30,fade=t=out:st=${FOUT}:d=0.35[v];\
[1:a]adelay=${LEAD}s:all=1,apad,atrim=0:${CLIP},aformat=sample_rates=44100:channel_layouts=stereo[a]" \
    -map "[v]" -map "[a]" -t "$CLIP" \
    -c:v libx264 -profile:v high -pix_fmt yuv420p -r 30 \
    -c:a aac -b:a 192k -ar 44100 \
    "build/clip$i.mp4" -loglevel error
done

# concat
: > build/list.txt
for i in 1 2 3 4 5 6; do echo "file 'clip$i.mp4'" >> build/list.txt; done
"$FFMPEG" -y -f concat -safe 0 -i build/list.txt -c copy build/nhs-privatisation-reel.mp4 -loglevel error

echo "=== FINAL ==="
"$FFMPEG" -i build/nhs-privatisation-reel.mp4 2>&1 | grep -E 'Duration|Stream'
ls -la build/nhs-privatisation-reel.mp4
