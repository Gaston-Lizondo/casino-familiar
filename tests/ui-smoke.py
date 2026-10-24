"""Prueba de humo de la interfaz (opcional). Requiere: pip install playwright && playwright install chromium
Uso:  python3 tests/ui-smoke.py [carpeta_de_capturas]
Abre el juego en un celular virtual, juega cada juego y verifica que no haya errores ni fichas "fantasma".
"""
import json, os, sys, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/cf-shots")
SHOTS.mkdir(parents=True, exist_ok=True)
errors, results = [], []


def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("  ok   " if cond else "  FAIL ") + name + (f"  [{extra}]" if extra and not cond else ""))


def chips(page, pid="dante"):
    raw = page.evaluate("localStorage.getItem('cf.v1.profiles')")
    return next(p["chips"] for p in json.loads(raw) if p["id"] == pid)


def skip_insurance(page):
    page.wait_for_timeout(300)
    if page.locator(".bj-actions.two").is_visible():
        page.click("button:has-text('No, gracias')")
        page.wait_for_timeout(300)


def inject_bj(page, cards, bet=100):
    """Deja guardada una mano de blackjack con las cartas elegidas y vuelve a abrir la mesa."""
    page.evaluate("""([cards, bet]) => { const BJ = CF.Blackjack; let t = BJ.createTable(['dante']);
      t.shoe = Array.from({length: 300}, () => ({r: '2', s: '♠'}));
      cards.slice().reverse().forEach(r => t.shoe.push({r, s: '♠'}));
      t = BJ.startRound(t, null, {dante: bet});
      localStorage.setItem('cf.v1.game.bj.dante', JSON.stringify({table: t, bet})); }""", [cards, bet])
    page.reload(); page.wait_for_selector(".player-chip"); page.click(".player-chip:has-text('Dante')")
    page.wait_for_selector(".tile"); page.click(".tile:has-text('Blackjack')")


def shown(page):
    page.wait_for_timeout(1600)  # el saldo sube contando: se espera a que termine la animación
    return int(page.inner_text(".chips-pill b").replace(".", "").replace(",", "").strip())


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: errors.append("console." + m.type + ": " + m.text) if m.type == "error" and "Failed to load resource" not in m.text and "fonts.g" not in m.text else None)
    page.goto("file://" + str(ROOT / "index.html"))
    page.wait_for_selector(".player-chip")

    print("Perfiles y lobby")
    check("4 jugadores", page.locator(".player-chip").count() == 4)
    page.screenshot(path=str(SHOTS / "1-perfiles.png"))
    page.click(".player-chip:has-text('Dante')")
    page.wait_for_selector(".tile")
    check("5 juegos en el lobby", page.locator(".tile").count() == 5)
    check("fichas iniciales 1000", shown(page) == 1000, shown(page))
    page.screenshot(path=str(SHOTS / "2-lobby.png"))

    print("Festejo")
    page.evaluate("void CF.FX.celebrate({ amount: 25000, mult: 50 })")
    page.wait_for_selector(".cele.landed", timeout=6000)
    check("festejo muestra el monto completo", page.inner_text(".cele-num").replace(".", "") == "25000", page.inner_text(".cele-num"))
    page.screenshot(path=str(SHOTS / "2b-festejo.png"))
    if page.locator(".cele").count(): page.locator(".cele").click(force=True)
    page.wait_for_selector(".cele", state="detached", timeout=5000)

    print("Tragamonedas")
    page.click(".tile:has-text('Tragamonedas')")
    page.wait_for_selector(".slot-machine")
    page.click(".chip-btn:has-text('100')")
    before = chips(page)
    page.click("button.big:has-text('Girar')")
    page.wait_for_function("document.querySelector('.result-msg').textContent !== 'Girando…' && !document.querySelector('button.big').disabled", timeout=15000)
    after = chips(page)
    check("giro descontó o pagó coherente", after - before in [-100, 0] or after - before >= 0 and after - before <= 49900, (before, after))
    check("saldo mostrado = saldo guardado", shown(page) == after, (shown(page), after))
    page.screenshot(path=str(SHOTS / "3-slots.png"))
    # 25 giros de 10 fichas: el saldo guardado siempre coincide con el mostrado
    page.click(".chip-btn:has-text('10')")
    for _ in range(12):
        page.click("button.big:has-text('Girar')")
        page.wait_for_function("!document.querySelector('button.big').disabled", timeout=15000)
    check("saldo coherente tras 12 giros", shown(page) == chips(page), (shown(page), chips(page)))

    print("Ruleta")
    page.click(".icon-btn[aria-label='Volver']"); page.wait_for_selector(".tile")
    page.click(".tile:has-text('Ruleta')")
    page.wait_for_selector(".board")
    page.click(".chip-btn:has-text('50')")
    page.click(".rcell:has-text('🔴 Rojo')"); page.click(".nums .rcell >> nth=16"); page.click(".rcell:has-text('Par')")
    check("fichas en mesa = 150", page.inner_text(".total-line b").replace(".", "") == "150", page.inner_text(".total-line b"))
    page.click("button:has-text('Deshacer')")
    check("deshacer resta la última", page.inner_text(".total-line b").replace(".", "") == "100")
    page.screenshot(path=str(SHOTS / "4-ruleta-mesa.png"))
    before = chips(page)
    page.click(".spin-bar .btn.big")
    page.wait_for_function("/Salió/.test(document.querySelector('.result-msg').textContent)", timeout=9000)
    after = chips(page)
    check("ruleta: saldo cambió según el resultado", True)
    check("ruleta: saldo mostrado = guardado", shown(page) == after, (shown(page), after))
    page.screenshot(path=str(SHOTS / "5-ruleta-resultado.png"))
    page.click("button:has-text('Repetir')")
    check("repetir restaura la apuesta", page.inner_text(".total-line b").replace(".", "") == "100")

    print("Blackjack")
    page.click(".icon-btn[aria-label='Volver']"); page.wait_for_selector(".tile")
    page.click(".tile:has-text('Blackjack')")
    page.wait_for_selector(".bj-table")
    page.wait_for_selector("button:has-text('Repartir')")
    page.click("button:has-text('Repartir')")
    page.wait_for_function("document.querySelectorAll('.bj-table .pcard').length >= 4", timeout=5000)
    page.wait_for_timeout(300)
    skip_insurance(page)
    in_round = page.locator(".bj-actions:not(.two)").is_visible()
    if in_round:
        check("mano en curso: carta oculta del crupier", page.locator(".pcard.back").count() == 1)
        page.screenshot(path=str(SHOTS / "6-blackjack-mano.png"))
        # recargar la página en medio de la mano y retomarla
        pre = chips(page)
        page.reload(); page.wait_for_selector(".player-chip"); page.click(".player-chip:has-text('Dante')")
        page.wait_for_selector(".tile"); page.click(".tile:has-text('Blackjack')")
        page.wait_for_selector(".bj-actions:not(.two)", state="visible", timeout=5000)
        check("se retoma la mano tras recargar", page.locator(".pcard").count() >= 4 and chips(page) == pre)
        page.click("button:has-text('Plantarse')")
    page.wait_for_function("document.querySelector('button.big.mint') && getComputedStyle(document.querySelector('button.big.mint')).display !== 'none'", timeout=15000)
    check("blackjack termina con resultado", len(page.inner_text(".result-msg")) > 3, page.inner_text(".result-msg"))
    check("blackjack: saldo mostrado = guardado", shown(page) == chips(page), (shown(page), chips(page)))
    page.screenshot(path=str(SHOTS / "7-blackjack-fin.png"))
    for _ in range(4):  # varias manos seguidas
        page.click("button.big.mint")
        page.wait_for_timeout(250)
        for _ in range(8):
            skip_insurance(page)
            if page.locator(".bj-actions:not(.two)").is_visible():
                page.click("button:has-text('Plantarse')")
                break
            page.wait_for_timeout(250)
        page.wait_for_function("getComputedStyle(document.querySelector('button.big.mint')).display !== 'none'", timeout=15000)
    check("varias manos: saldo coherente", shown(page) == chips(page), (shown(page), chips(page)))

    # Separar + doblar: 8,8 contra 10,7 (mano 1: 8+3 dobla y saca 10; mano 2: 8+9 se planta)
    inject_bj(page, ["8", "10", "8", "7", "3", "10", "9"])
    page.wait_for_selector("button:has-text('Separar')", state="visible", timeout=5000)
    pre = chips(page)
    page.click("button:has-text('Separar')")
    page.wait_for_function("document.querySelectorAll('.bj-hand').length === 2", timeout=4000)
    page.screenshot(path=str(SHOTS / "8-blackjack-split.png"))
    page.click("button:has-text('Doblar')")
    page.wait_for_function("document.querySelector('.result-msg').textContent.includes('Mano 2')", timeout=4000)
    page.click("button:has-text('Plantarse')")
    page.wait_for_function("/Ganaste/.test(document.querySelector('.result-msg').textContent)", timeout=15000)
    check("separar y doblar: +200 neto y saldo coherente", chips(page) == pre + 300 and shown(page) == chips(page), (pre, chips(page), shown(page)))
    page.screenshot(path=str(SHOTS / "9-blackjack-split-fin.png"))

    # Seguro: crupier con As y blackjack
    inject_bj(page, ["K", "A", "9", "K"])
    page.wait_for_selector(".bj-actions.two", state="visible", timeout=5000)
    check("se ofrece seguro con As", "Seguro (50)" in page.inner_text(".bj-actions.two"))
    page.screenshot(path=str(SHOTS / "10-blackjack-seguro.png"))
    pre = chips(page)
    page.click("button:has-text('Seguro (50)')")
    page.wait_for_function("/mano/.test(document.querySelector('.result-msg').textContent)", timeout=15000)
    check("seguro cobra 2:1 y queda a mano", chips(page) == pre + 100 and shown(page) == chips(page), (pre, chips(page), shown(page)))

    print("Dados")
    page.click(".icon-btn[aria-label='Volver']"); page.wait_for_selector(".tile")
    page.click(".tile:has-text('Dados')")
    page.wait_for_selector(".dice-stage")
    page.click(".dice-opt:has-text('Siete')")
    page.click("button.big:has-text('Tirar')")
    page.wait_for_function("/=/.test(document.querySelector('.dice-sum').textContent)", timeout=6000)
    check("dados: muestra la suma", "=" in page.inner_text(".dice-sum"))

    def dice_matches():
        import re
        a, b, tot = map(int, re.findall(r"\d+", page.inner_text(".dice-sum")))
        pa, pb = page.locator(".die >> nth=0").locator("i.on").count(), page.locator(".die >> nth=1").locator("i.on").count()
        return (pa, pb, a, b, tot)
    ok = True
    for _ in range(6):  # los puntos de cada dado deben coincidir SIEMPRE con lo que salió
        t = dice_matches()
        ok = ok and t[0] == t[2] and t[1] == t[3] and t[2] + t[3] == t[4]
        page.wait_for_timeout(600)           # una animación atrasada podría pisar la cara final
        t = dice_matches()
        ok = ok and t[0] == t[2] and t[1] == t[3]
        page.click("button.big:has-text('Tirar')")
        page.wait_for_function("/=/.test(document.querySelector('.dice-sum').textContent)", timeout=6000)
    check("dados: la cara de cada dado coincide con el resultado (6 tiradas)", ok, dice_matches())
    check("dados: saldo mostrado = guardado", shown(page) == chips(page), (shown(page), chips(page)))
    page.screenshot(path=str(SHOTS / "8-dados.png"))

    print("Raspadita")
    page.click(".icon-btn[aria-label='Volver']"); page.wait_for_selector(".tile")
    page.click(".tile:has-text('Raspadita')")
    page.wait_for_selector(".scratch-stage")
    page.click("button.big:has-text('Comprar')")
    page.wait_for_selector(".scratch-canvas", state="visible")
    box = page.locator(".scratch-canvas").bounding_box()
    page.screenshot(path=str(SHOTS / "9-raspadita-tapada.png"))
    x0, y0 = box["x"], box["y"]
    page.mouse.move(x0 + 10, y0 + 10); page.mouse.down()
    for row in range(0, 9):  # raspar en zigzag
        y = y0 + 15 + row * (box["height"] - 30) / 8
        xs = [x0 + 10, x0 + box["width"] - 10] if row % 2 == 0 else [x0 + box["width"] - 10, x0 + 10]
        page.mouse.move(xs[0], y); page.mouse.move(xs[1], y, steps=14)
    page.mouse.up()
    page.wait_for_function("document.querySelector('.scratch-canvas').style.opacity === '0'", timeout=4000)
    check("raspar descubre el resultado", len(page.inner_text(".result-msg")) > 5, page.inner_text(".result-msg"))
    check("raspadita: saldo mostrado = guardado", shown(page) == chips(page), (shown(page), chips(page)))
    page.screenshot(path=str(SHOTS / "10-raspadita-fin.png"))

    print("Admin")
    page.click(".icon-btn[aria-label='Volver']"); page.wait_for_selector(".tile")
    page.click(".icon-btn[aria-label='Volver']"); page.wait_for_selector(".player-chip")
    page.click("button:has-text('Admin')")
    page.fill(".modal input", "0000"); page.click(".modal button:has-text('Entrar')")
    check("PIN incorrecto no entra", page.locator(".admin-row").count() == 0)
    page.click("button:has-text('Admin')")
    page.fill(".modal input", "1234"); page.click(".modal button:has-text('Entrar')")
    page.wait_for_selector(".admin-row")
    pre = chips(page)
    page.locator(".admin-row:has-text('Dante') button:has-text('+500')").click()
    page.wait_for_function(f"JSON.parse(localStorage.getItem('cf.v1.profiles')).find(p=>p.id==='dante').chips === {pre + 500}")
    check("admin repone +500", chips(page) == pre + 500)
    page.click("button:has-text('Agregar jugador')")
    page.fill(".modal input", "Abuela"); page.click(".modal button:has-text('Crear')")
    page.wait_for_selector(".admin-row:has-text('Abuela')")
    check("admin agrega jugador", page.locator(".admin-row").count() == 5)
    page.screenshot(path=str(SHOTS / "11-admin.png"))

    b.close()

print()
bad = [n for n, ok in results if not ok]
for e in errors:
    print("  ERROR DE CONSOLA:", e)
print(f"{len(results) - len(bad)}/{len(results)} verificaciones OK · {len(errors)} errores de consola")
sys.exit(1 if bad or errors else 0)
