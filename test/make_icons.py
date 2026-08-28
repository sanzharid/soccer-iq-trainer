"""Generate PWA icons (192/512 PNG) by rendering a canvas in headless chromium.
Run: python test/make_icons.py
"""
import pathlib, sys, glob, os

here = pathlib.Path(__file__).parent
out = here.parent / "icons"
out.mkdir(exist_ok=True)

HTML = """<!DOCTYPE html><html><body style="margin:0">
<canvas id="c" width="SIZE" height="SIZE"></canvas>
<script>
const c = document.getElementById('c'), g = c.getContext('2d'), S = c.width;
// rounded-square green background
const r = S * 0.18;
g.fillStyle = '#1b5e20';
g.beginPath(); g.roundRect(0, 0, S, S, r); g.fill();
// pitch stripe
g.fillStyle = '#2e7d32';
g.beginPath(); g.roundRect(0, S*0.28, S, S*0.44, 0); g.fill();
g.fillStyle = '#1b5e20';
g.beginPath(); g.roundRect(0, 0, S, S, r); g.globalCompositeOperation = 'destination-over'; g.fill();
g.globalCompositeOperation = 'source-over';
// ball
const cx = S/2, cy = S/2, br = S*0.30;
g.fillStyle = '#fff';
g.beginPath(); g.arc(cx, cy, br, 0, Math.PI*2); g.fill();
// pentagon spots
g.fillStyle = '#10241a';
function spot(px, py, pr) {
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI/2 + i * Math.PI*2/5;
    g[i ? 'lineTo' : 'moveTo'](px + pr*Math.cos(a), py + pr*Math.sin(a));
  }
  g.closePath(); g.fill();
}
spot(cx, cy, br*0.38);
spot(cx - br*0.75, cy - br*0.45, br*0.20);
spot(cx + br*0.75, cy - br*0.45, br*0.20);
spot(cx - br*0.55, cy + br*0.65, br*0.20);
spot(cx + br*0.55, cy + br*0.65, br*0.20);
</script></body></html>"""

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    if sys.platform == "win32":
        cache = os.path.expandvars(r"%LOCALAPPDATA%\ms-playwright")
        exe = sorted(glob.glob(os.path.join(
            cache, "chromium_headless_shell-*", "chrome-headless-shell-win64",
            "chrome-headless-shell.exe")))[-1]
        browser = p.chromium.launch(executable_path=exe)
    else:
        browser = p.chromium.launch()
    for size in (192, 512):
        page = browser.new_page(viewport={"width": size, "height": size})
        page.set_content(HTML.replace("SIZE", str(size)))
        page.wait_for_timeout(200)
        page.locator("#c").screenshot(path=str(out / f"icon-{size}.png"))
        page.close()
    browser.close()

print("icons written to", out)
