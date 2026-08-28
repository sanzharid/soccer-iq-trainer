"""Headless smoke test for Voetbal IQ: serve locally, play every drill and a
full session via window.__test hooks, check console errors, save screenshots.

Run: python test/smoketest.py   (playwright + chromium required)
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

DRILLS = ["decision", "scanning", "anticipation", "memory"]

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

        def play_rounds(n):
            """Answer n rounds alternating correct/wrong, waiting for advance."""
            for i in range(1, n + 1):
                fn = "window.__test.answerCorrect()" if i % 2 else "window.__test.answerWrong()"
                page.evaluate(fn)
                if i < n:
                    page.wait_for_function(
                        f"window.__test.drillState() && window.__test.drillState().round === {i + 1}",
                        timeout=8000)
                else:
                    page.wait_for_function(
                        "window.__test.screen() === 'result'", timeout=8000)

        # --- each drill individually, 3 rounds ---
        for drill in DRILLS:
            page.evaluate(f"window.__test.startDrill('{drill}', 3)")
            page.wait_for_timeout(400)
            check(page.evaluate("window.__test.screen()") == "drill", f"{drill}: drill screen started")
            check(page.evaluate("window.__test.scenario()") is not None, f"{drill}: round context exists")
            page.screenshot(path=str(shots / f"3_drill_{drill}.png"))
            play_rounds(3)
            check(page.evaluate("window.__test.screen()") == "result", f"{drill}: result after 3 rounds")
            page.evaluate("window.__test.store()")  # touch
            # back to home for next drill
            page.evaluate("window.__test.setProfile('Test')")

        # --- full session: 4 drills x 6 rounds ---
        page.evaluate("window.__test.startSession()")
        page.wait_for_timeout(400)
        for i in range(24):
            fn = "window.__test.answerCorrect()" if i % 2 else "window.__test.answerWrong()"
            page.evaluate(fn)
            page.wait_for_timeout(1600)
            if page.evaluate("window.__test.screen()") == "result":
                break
        check(page.evaluate("window.__test.screen()") == "result", "session: result screen after 24 rounds")
        page.screenshot(path=str(shots / "4_result_session.png"))

        data = page.evaluate("window.__test.store()")
        # 4 single drills (recorded each) + 1 composed session
        check(data and len(data["sessions"]) == 5, f"5 sessions recorded ({len(data['sessions']) if data else 0})")
        check(data and data["streakDays"] == 1, "streak = 1 after first day")
        levels = data["levels"] if data else {}
        check(set(levels.keys()) == set(DRILLS), f"levels tracked for all drills ({sorted(levels)})")
        browser.close()
finally:
    httpd.shutdown()

print("console errors:", errors if errors else "none")
if errors:
    failures.append("console errors")
sys.exit(1 if failures else 0)
