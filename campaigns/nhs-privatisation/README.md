# NHS Privatisation — TikTok Reel

A ~54-second vertical (1080×1920) TikTok reel for the **Keep Our NHS Public** campaign,
covering the 2025 10-Year Health Plan, the financial drain of privatisation, widening
inequality, and patient-safety costs.

## Deliverable

- **`build/nhs-privatisation-reel.mp4`** — the finished reel (H.264 / AAC, ~2 MB)
- **`CAPTION.txt`** — ready-to-paste caption + hashtags
- **`SCRIPT.md`** — narration script, on-screen text, and source facts

## Assets

| Folder | Contents |
|--------|----------|
| `slides/` | 6 rendered slide images (`slide1`–`slide6.png`) |
| `audio/`  | 6 narration beats (`seg1`–`seg6.mp3`), AI voiceover |
| `build/`  | per-beat clips + concatenated final reel |

## How it was made

1. **Voiceover** — script split into 6 beats, narrated with ElevenLabs text-to-speech.
2. **Slides** — `make_slides.py` renders the vertical text cards with Pillow.
3. **Assembly** — `build_video.sh` times each slide to its narration beat, adds
   fade transitions, and concatenates into the final MP4 with ffmpeg.

### Rebuild

```bash
pip install pillow imageio-ffmpeg   # ffmpeg binary comes with imageio-ffmpeg
python3 make_slides.py              # regenerate slides
bash build_video.sh                 # re-assemble build/nhs-privatisation-reel.mp4
```

(Re-generating the voiceover requires an ElevenLabs credential; the existing
`audio/seg*.mp3` files are committed so the video can be rebuilt without it.)

## Publish to TikTok via the Postiz CLI

Media must be uploaded to Postiz first (TikTok only accepts trusted URLs):

```bash
# 1. Upload the reel
VIDEO=$(postiz upload campaigns/nhs-privatisation/build/nhs-privatisation-reel.mp4)
VIDEO_URL=$(echo "$VIDEO" | jq -r '.path')

# 2. Find your TikTok integration id
TIKTOK_ID=$(postiz integrations:list | jq -r '.[] | select(.identifier=="tiktok") | .id')

# 3. Schedule the post (caption in CAPTION.txt)
postiz posts:create \
  -c "$(cat campaigns/nhs-privatisation/CAPTION.txt)" \
  -s "2026-08-08T17:00:00Z" \
  --settings '{"privacy":"PUBLIC_TO_EVERYONE","duet":true,"stitch":true}' \
  -m "$VIDEO_URL" \
  -i "$TIKTOK_ID"
```
