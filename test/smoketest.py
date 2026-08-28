"""Headless smoke test for Voetbal IQ: serve locally, play every drill and a
full session via window.__test hooks, check console errors, save screenshots.

Note: answer hooks are gated like real taps — the test waits for each round's
answer phase (drillState().accepting) before answering.

Run: python test/smoketest.py   (playwright + chromium required)
Exit code 0 = pass.
"""
import pathlib, sys, threading, functools, http.server, socketserver, glob, os, time

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

        # PWA basics
        manifest_ok = page.evaluate(
            "fetch('manifest.webmanifest').then(r => r.ok && r.json()).then(m => m.name === 'Voetbal IQ')")
        check(manifest_ok, "manifest served and valid")
        sw_ok = page.evaluate(
            "navigator.serviceWorker ? navigator.serviceWorker.ready.then(r => !!r.active) : false")
        check(sw_ok, "service worker registered and active")

        page.evaluate("window.__test.setProfile('Test')")
        check(page.evaluate("window.__test.screen()") == "home", "home after profile set")
        page.screenshot(path=str(shots / "2_home.png"))

        def wait_accepting(round_no, timeout=20000):
            page.wait_for_function(
                "window.__test.drillState() && "
                f"window.__test.drillState().round === {round_no} && "
                "window.__test.drillState().accepting",
                timeout=timeout)

        def play_rounds(n):
            """Answer n rounds alternating correct/wrong, waiting for each
            round's answer phase first."""
            for i in range(1, n + 1):
                wait_accepting(i)
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
            if drill == "scanning":
                import math
                sc = page.evaluate("window.__test.scenario()")
                reds = [p for p in sc["players"] if p["team"] == "red"]
                blues = [p for p in sc["players"] if p["team"] == "blue"]
                free = sc["players"][sc["freeIndex"]]
                dist = lambda a, b: math.hypot(a["x"] - b["x"], a["y"] - b["y"])
                marked = all(min(dist(r, b) for b in blues) < 0.13 for r in reds if r is not free)
                free_clear = min(dist(free, b) for b in blues) > 0.20
                check(marked and free_clear, "scanning: exactly one unmarked red (unambiguous)")
            page.screenshot(path=str(shots / f"3_drill_{drill}.png"))
            play_rounds(3)
            check(page.evaluate("window.__test.screen()") == "result", f"{drill}: result after 3 rounds")
            page.evaluate("window.__test.setProfile('Test')")  # back home

        # --- scanning invariant over multiple fresh scenarios ---
        import math
        def dist2(a, b):
            return math.hypot(a["x"] - b["x"], a["y"] - b["y"])
        def distC(a, b):  # aspect-corrected, same metric as tap hit-testing
            return math.hypot(a["x"] - b["x"], (a["y"] - b["y"]) * 0.62)
        bad = 0
        for _ in range(10):
            page.evaluate("window.__test.startDrill('scanning', 1)")
            page.wait_for_timeout(300)
            sc = page.evaluate("window.__test.scenario()")
            reds = [p for p in sc["players"] if p["team"] == "red"]
            blues = [p for p in sc["players"] if p["team"] == "blue"]
            free = sc["players"][sc["freeIndex"]]
            marked = all(min(dist2(r, b) for b in blues) < 0.13 for r in reds if r is not free)
            free_clear = min(dist2(free, b) for b in blues) > 0.20
            free_clear_corr = min(distC(free, b) for b in blues) > 0.20
            if not (marked and free_clear and free_clear_corr):
                bad += 1
            page.evaluate("window.__test.quit()")   # quit records no session
            page.wait_for_timeout(200)
        check(bad == 0, f"scanning invariant holds over 10 scenarios (bad: {bad})")
        page.evaluate("window.__test.setProfile('Test')")  # back home

        # --- quit flows ---
        # UI path: ✕ button -> confirm overlay -> "Verder spelen" resumes the round
        page.evaluate("window.__test.startDrill('decision', 5)")
        page.wait_for_function("window.__test.drillState() && window.__test.drillState().accepting", timeout=10000)
        sessions_before = page.evaluate("window.__test.store()")["sessions"].__len__()
        page.click("[data-quit]")
        page.wait_for_timeout(200)
        check(page.evaluate("!document.querySelector('[data-overlay]').hidden"), "quit: X button shows confirm overlay")
        page.screenshot(path=str(shots / "5_quit_confirm.png"))
        page.click("[data-no]")
        page.wait_for_timeout(200)
        check(page.evaluate("document.querySelector('[data-overlay]').hidden"), "quit: 'Verder spelen' hides overlay")
        st = page.evaluate("window.__test.drillState()")
        check(st and st["round"] == 1 and page.evaluate("window.__test.screen()") == "drill",
              "quit: drill still on round 1 after resume")
        # hook path: quit mid-drill -> home, no session recorded
        page.evaluate("window.__test.quit()")
        page.wait_for_timeout(300)
        check(page.evaluate("window.__test.screen()") == "home", "quit mid-drill returns home")
        check(page.evaluate("window.__test.store()")["sessions"].__len__() == sessions_before,
              "quit mid-drill records no session")
        # quit mid-session aborts the whole session
        page.evaluate("window.__test.startSession()")
        page.wait_for_function("window.__test.drillState() && window.__test.drillState().accepting", timeout=10000)
        page.evaluate("window.__test.answerCorrect()")
        page.wait_for_function("window.__test.drillState() && window.__test.drillState().round === 2", timeout=8000)
        page.evaluate("window.__test.quit()")
        page.wait_for_timeout(300)
        check(page.evaluate("window.__test.screen()") == "home", "quit mid-session returns home")
        check(page.evaluate("window.__test.store()")["sessions"].__len__() == sessions_before,
              "quit mid-session records no session")
        # after quit, pending drill timers must be dead: wait past a round boundary
        page.wait_for_timeout(2500)
        check(page.evaluate("window.__test.screen()") == "home", "no zombie drill activity after quit")

        # --- full session: 4 drills x 6 rounds (round counter resets per drill) ---
        page.evaluate("window.__test.startSession()")
        page.wait_for_timeout(400)
        answered = set()
        deadline = time.time() + 240
        while time.time() < deadline:
            if page.evaluate("window.__test.screen()") == "result":
                break
            st = page.evaluate("window.__test.drillState()")
            if st and st["accepting"] and (st["drill"], st["round"]) not in answered:
                answered.add((st["drill"], st["round"]))
                fn = "window.__test.answerCorrect()" if len(answered) % 2 else "window.__test.answerWrong()"
                page.evaluate(fn)
            page.wait_for_timeout(300)
        check(page.evaluate("window.__test.screen()") == "result",
              f"session: result screen ({len(answered)} rounds answered)")
        check(len(answered) == 24, f"session: all 24 rounds answered ({len(answered)})")
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
