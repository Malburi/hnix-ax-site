"""draw.io → 쪽마다 PNG. diagrams.net 공식 뷰어(viewer.diagrams.net)를 헤드리스 Chrome 으로 띄워 찍는다.
사용: python tools/render_drawio.py <파일.drawio> <출력 접두사> <쪽 수>   (Playwright·Chrome 필요, 뷰어를 받으려면 인터넷)
예:   python tools/render_drawio.py download/hnix-ax-ecosystem.drawio img/ecosystem 4  → img/ecosystem-p1.png …
"""
import html as htmllib, json, os, sys
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
xml = open(os.path.join(ROOT, sys.argv[1]), encoding="utf-8").read()
prefix = sys.argv[2]
pages = int(sys.argv[3])

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    for i in range(pages):
        cfg = {"page": i, "xml": xml, "toolbar": "", "lightbox": False, "nav": False, "resize": True, "highlight": "none"}
        html = ("<!doctype html><html><head><meta charset='utf-8'></head><body style='margin:0;background:#fff'>"
                f"<div class='mxgraph' style='max-width:100%' data-mxgraph=\"{htmllib.escape(json.dumps(cfg), quote=True)}\"></div>"
                "<script src='https://viewer.diagrams.net/js/viewer-static.min.js'></script></body></html>")
        pg = b.new_page(viewport={"width": 1820, "height": 1000}, device_scale_factor=1.5)
        errors = []
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.set_content(html, wait_until="networkidle", timeout=120000)
        pg.wait_for_function("() => !!window.GraphViewer", timeout=60000)
        pg.evaluate("() => { if (!document.querySelector('div.mxgraph svg')) GraphViewer.processElements(); }")
        try:
            pg.wait_for_selector("div.mxgraph svg", timeout=60000)
        except Exception:
            print("render failed:", errors[:5]); raise
        pg.wait_for_timeout(1500)
        el = pg.query_selector("div.mxgraph")
        out = os.path.join(ROOT, f"{prefix}-p{i + 1}.png")
        el.screenshot(path=out)
        print("->", out)
        pg.close()
    b.close()
