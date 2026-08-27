"""Headless smoke test for Voetbal IQ: serve locally, play a full decision-drill
session via window.__test hooks, check console errors, save screenshots.

Run: ../../.venv-pdf/Scripts/python test/smoketest.py   (from repo root, any cwd works)
Exit code 0 = pass.
"""
import pathlib, sys, threading, functools, http.server, socketserver, glob, os

here = pathlib.Path(__file__).parent
root = here.parent
shots = here / "shots"
shots.mkdir(exist_ok=True)

PORT = 8931
errors = []
failures = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        failures.append(msg)


# --- local static server (ES modules don't work over file://) ---
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

try:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        if sys.platform == "win32":
            cache = os.path.expandvars(r"%LOCALAPPDATA%\ms-playwright")
            exe = sorted(glob.glob(os.path.join(
                cache, "chromium_headless_shell-*", "chrome-headless-shell-win64",
                "chrome-headless-shell.exe")))[-1]
            browser = p.chromium.launch(executable_path=exe)
        else:
            browser = p.chromium.launch()  # playwright's installed chromium
        page = browser.new_page(viewport={"width": 1024, "height": 768})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(f"http://127.0.0.1:{PORT}/")
        page.wait_for_timeout(800)

        check(page.evaluate("window.__test.screen()") == "name", "first run shows name screen")
        page.screenshot(path=str(shots / "1_name.png"))

        page.evaluate("window.__test.setProfile('Test')")
        check(page.evaluate("window.__test.screen()") == "home", "home after profile set")
        page.screenshot(path=str(shots / "2_home.png"))

        page.evaluate("window.__test.startDrill()")
        page.wait_for_timeout(300)
        check(page.evaluate("window.__test.screen()") == "drill", "drill screen started")
        sc = page.evaluate("window.__test.scenario()")
        check(sc and len(sc["players"]) >= 4, f"scenario has players ({len(sc['players']) if sc else 0})")
        check(sc and sc["correctIndex"] in sc["optionIndices"], "correctIndex is a valid option")
        page.screenshot(path=str(shots / "3_drill.png"))

        # play all 8 rounds: alternate correct/wrong, wait for round to advance
        for i in range(1, 9):
            fn = "window.__test.answerCorrect()" if i % 2 else "window.__test.answerWrong()"
            page.evaluate(fn)
            if i < 8:
                page.wait_for_function(
                    f"window.__test.drillState() && window.__test.drillState().round === {i + 1}",
                    timeout=5000)
            else:
                page.wait_for_function(
                    "window.__test.screen() === 'result'", timeout=5000)

        st = page.evaluate("window.__test.drillState()")
        check(page.evaluate("window.__test.screen()") == "result", "result screen after 8 rounds")
        page.screenshot(path=str(shots / "4_result.png"))

        data = page.evaluate("window.__test.store()")
        check(data and len(data["sessions"]) == 1, "session recorded in localStorage")
        check(data and len(data["history"]) == 8, f"8 rounds in history ({len(data['history']) if data else 0})")
        check(data and data["streakDays"] == 1, "streak = 1 after first session")
        browser.close()
finally:
    httpd.shutdown()

print("console errors:", errors if errors else "none")
if errors:
    failures.append("console errors")
sys.exit(1 if failures else 0)
