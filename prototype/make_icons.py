#!/usr/bin/env python3
"""Erzeugt die App-Symbole für den Homescreen — ohne Bildbibliothek.

    python3 prototype/make_icons.py

Das Zeichen: drei Zeilen auf dunklem Grund, die kürzeste in Gold. Sprache als
Zeilen, nicht als nachgemachtes sitelen pona — eine eigene Marke, die auch bei
48 Pixeln noch lesbar ist.
"""
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GROUND = (0x14, 0x3A, 0x38)
INK = (0xEF, 0xF1, 0xEE)
GOLD = (0xD9, 0xAB, 0x54)


def rounded_rect(pixels, size, x0, y0, x1, y1, radius, colour):
    for y in range(max(0, int(y0)), min(size, int(y1) + 1)):
        for x in range(max(0, int(x0)), min(size, int(x1) + 1)):
            cx = min(max(x, x0 + radius), x1 - radius)
            cy = min(max(y, y0 + radius), y1 - radius)
            if (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2 + radius:
                pixels[y][x] = colour


def icon(size):
    # Vollflächig: die Systeme runden selbst ab (maskable), und Apple ignoriert
    # Transparenz ohnehin.
    pixels = [[GROUND] * size for _ in range(size)]

    # Drei Zeilen, die mittlere am längsten, die kürzeste in Gold.
    inset = size * 0.22
    height = size * 0.085
    gap = size * 0.115
    top = size * 0.30
    widths = [0.74, 1.0, 0.46]
    for index, factor in enumerate(widths):
        y0 = top + index * (height + gap)
        colour = GOLD if index == len(widths) - 1 else INK
        rounded_rect(pixels, size, inset, y0, inset + (size - 2 * inset) * factor,
                     y0 + height, height / 2, colour)
    return pixels


def write_png(path, pixels):
    size = len(pixels)
    raw = b"".join(
        b"\x00" + b"".join(struct.pack("3B", *pixel) for pixel in row) for row in pixels
    )

    def chunk(tag, payload):
        body = tag + payload
        return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body))

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    path.write_bytes(png)
    return len(png)


def main():
    out = ROOT / "docs"
    out.mkdir(exist_ok=True)
    for size in (192, 512):
        written = write_png(out / f"icon-{size}.png", icon(size))
        print(f"docs/icon-{size}.png: {written // 1024 or 1} KB")
    # Apple ignoriert Transparenz und runde Ecken selbst — volle Fläche.
    written = write_png(out / "apple-touch-icon.png", icon(180))
    print(f"docs/apple-touch-icon.png: {written // 1024 or 1} KB")


if __name__ == "__main__":
    main()
