#!/usr/bin/env python3
"""
Escanea la carpeta /music y genera music/playlist.json
Nombrá los archivos como "Artista - Titulo.mp3" para que el
título y artista se detecten solos. Si no, se usa el nombre del
archivo como título.

Uso:
    python3 scripts/generate_playlist.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MUSIC_DIR = os.path.join(ROOT, "music")
OUTPUT = os.path.join(MUSIC_DIR, "playlist.json")
VALID_EXT = {".mp3", ".m4a", ".ogg", ".wav", ".flac"}


def parse_title(filename):
    base, _ = os.path.splitext(filename)
    if " - " in base:
        artist, title = base.split(" - ", 1)
        return artist.strip(), title.strip()
    return "", base.strip()


def main():
    if not os.path.isdir(MUSIC_DIR):
        print(f"No existe la carpeta {MUSIC_DIR}")
        return

    files = sorted(
        f for f in os.listdir(MUSIC_DIR)
        if os.path.splitext(f)[1].lower() in VALID_EXT
    )

    tracks = []
    for f in files:
        artist, title = parse_title(f)
        tracks.append({"file": f, "title": title, "artist": artist})

    with open(OUTPUT, "w", encoding="utf-8") as fh:
        json.dump(tracks, fh, ensure_ascii=False, indent=2)

    print(f"{len(tracks)} canciones escritas en {OUTPUT}")


if __name__ == "__main__":
    main()
