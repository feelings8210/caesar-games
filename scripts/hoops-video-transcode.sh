#!/usr/bin/env bash
# Run via the registered media.ffmpeg worker with input SHA in its manifest.
# This creates a review candidate, not an accepted or published video.
set -euo pipefail
if [[ $# -ne 1 || -z "${MF_OUTPUT_DIR:-}" ]]; then
  echo 'Usage: MF_OUTPUT_DIR=<worker output> hoops-video-transcode.sh input.webm' >&2
  exit 2
fi
input=$1
[[ -f "$input" && ! -e "$MF_OUTPUT_DIR/video.mp4" && ! -e "$MF_OUTPUT_DIR/probe.json" ]] || exit 2
ffmpeg -nostdin -v error -i "$input" -map 0:v:0 -map 0:a:0 \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart "$MF_OUTPUT_DIR/video.mp4"
ffprobe -v error -show_format -show_streams -of json "$MF_OUTPUT_DIR/video.mp4" > "$MF_OUTPUT_DIR/probe.json"
