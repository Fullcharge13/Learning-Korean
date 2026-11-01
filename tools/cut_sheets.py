#!/usr/bin/env python3
"""참고 그림 시트 → 앱 그림 PNG (한 번 실행해 결과를 커밋).

    python3 tools/cut_sheets.py

- docs/img/ref/haechi-sheet.jpg → src/img/haechi/<표정>.png
- docs/img/ref/items-sheet.jpg  → src/img/items/<물건>.png
- 칸 좌표는 시트(2576×1438)에서 배경과 다른 영역을 찾아 정한 값. 정사각형 캔버스에 가운데 맞춰 256px.
- 시트 배경색(크림)에 가까운 픽셀은 투명하게(가장자리는 반투명) — 앱의 모눈 배경 위에 그림 상자가 보이지 않게.
- 미리보기: docs/img/haechi-preview.png (자른 그림을 한 장에)
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZE, PAD = 256, 14
BG = (254, 250, 241)  # 해치 시트 배경
NEAR, FAR = 18, 60      # 배경과의 색 거리: NEAR 이하 투명, FAR 이상 불투명

HAECHI = {  # (x0, y0, x1, y1)
    "smile": (189, 73, 483, 510), "surprise": (1614, 73, 1973, 510), "joy": (2080, 73, 2432, 510),
    "wink": (152, 544, 504, 962), "sparkle": (682, 544, 988, 962), "sleepy": (1151, 544, 1474, 962),
    "cheer": (2124, 544, 2429, 962),
    "think": (163, 999, 510, 1394), "worry": (794, 999, 1110, 1394), "hello": (1442, 999, 1878, 1394),
    "done": (2083, 999, 2439, 1394),
}
ITEMS = {
    "maetdol": (139, 83, 553, 483), "janggu": (642, 83, 1014, 483), "jige": (1134, 83, 1488, 483),
    "buchae": (139, 548, 546, 940), "gat": (647, 548, 1013, 940), "bokjumeoni": (1139, 548, 1474, 940),
    "yeon": (133, 1001, 540, 1394), "but": (752, 1001, 1456, 1394), "buk": (1590, 1001, 1987, 1394),
}


def cut(sheet, box):
    x0, y0, x1, y1 = box
    part = sheet.crop((x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD))
    side = max(part.size)
    canvas = Image.new("RGB", (side, side), BG)
    canvas.paste(part, ((side - part.width) // 2, (side - part.height) // 2))
    im = canvas.resize((SIZE, SIZE), Image.LANCZOS).convert("RGBA")
    px = im.load()
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, _ = px[x, y]
            d = abs(r - BG[0]) + abs(g - BG[1]) + abs(b - BG[2])
            if d < FAR:
                px[x, y] = (r, g, b, 0 if d <= NEAR else round(255 * (d - NEAR) / (FAR - NEAR)))
    return im


def main():
    out = []
    for sheet_name, table, folder in (("haechi-sheet.jpg", HAECHI, "haechi"), ("items-sheet.jpg", ITEMS, "items")):
        sheet = Image.open(os.path.join(ROOT, "docs", "img", "ref", sheet_name)).convert("RGB")
        os.makedirs(os.path.join(ROOT, "src", "img", folder), exist_ok=True)
        for name, box in table.items():
            im = cut(sheet, box)
            im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(os.path.join(ROOT, "src", "img", folder, name + ".png"), optimize=True)
            out.append(im)
    cols = 6
    prev = Image.new("RGB", (cols * SIZE, ((len(out) + cols - 1) // cols) * SIZE), (210, 225, 235))
    for i, im in enumerate(out):
        prev.paste(im, ((i % cols) * SIZE, (i // cols) * SIZE), im)
    prev.save(os.path.join(ROOT, "docs", "img", "haechi-preview.png"), optimize=True)
    print("%d pictures" % len(out))


if __name__ == "__main__":
    main()
