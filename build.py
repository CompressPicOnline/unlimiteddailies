#!/usr/bin/env python3
"""Builds the static pages of unlimiteddailies.com into ./site (deploy that folder)."""
import json, os, shutil, datetime

DOMAIN = "https://unlimiteddailies.com"
SITE = "Unlimited Dailies"
EMAIL = "contact@unlimiteddailies.com"
TODAY = datetime.date.today().isoformat()
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")
V = "7"  # bump to bust asset cache
INDEXNOW_KEY = "3753766b9ea89f1d1682ceed22f858eb"  # IndexNow key file served at /<key>.txt

NAV = [("/sumbreak-unlimited/", "Sumbreak"), ("/queens-unlimited/", "Queens"), ("/tango-unlimited/", "Tango"), ("/zip-unlimited/", "Zip")]

def head(title, desc, path, extra_schema=None, noindex=False):
    url = DOMAIN + path
    schemas = [{
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [{"@type": "ListItem", "position": 1, "name": SITE, "item": DOMAIN + "/"}] +
        ([{"@type": "ListItem", "position": 2, "name": title.split(" – ")[0].split(" | ")[0], "item": url}] if path != "/" else [])
    }]
    if extra_schema:
        schemas += extra_schema
    sch = "\n".join('<script type="application/ld+json">%s</script>' % json.dumps(s, ensure_ascii=False) for s in schemas)
    return f"""<!doctype html>
<html lang="en">
<head>
<script>
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({{'gtm.start': new Date().getTime(), event: 'gtm.js'}});
  function gtag(){{dataLayer.push(arguments);}}
</script>
<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-52WF64FM"></script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
{'<meta name="robots" content="noindex">' if noindex else '<meta name="robots" content="index,follow,max-image-preview:large">'}
<meta property="og:type" content="website">
<meta property="og:site_name" content="{SITE}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{DOMAIN}/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#2f6fed">
<meta name="monetag" content="c643b64e9fb0e1e28f59dc44caa0c5cc">
<meta name="msvalidate.01" content="DCD9377743936F2F6B4B5754198E0DD4">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/style.css?v={V}">
{sch}
</head>
<body>
<header class="site"><div class="wrap">
<a class="logo" href="/"><span>∞</span> Unlimited Dailies</a>
<nav class="top">{''.join(f'<a href="{h}">{t}</a>' for h, t in NAV)}</nav>
</div></header>
<main><div class="wrap">
"""

FOOT = f"""</div></main>
<footer class="site"><div class="wrap">
<p><a href="/">Home</a><a href="/sumbreak-unlimited/">Sumbreak Unlimited</a><a href="/sumbreak-solver/">Sumbreak Solver</a><a href="/how-to-play-sumbreak/">How to Play Sumbreak</a><a href="/queens-unlimited/">Queens Unlimited</a><a href="/queens-solver/">Queens Solver</a><a href="/tango-unlimited/">Tango Unlimited</a><a href="/tango-solver/">Tango Solver</a><a href="/zip-unlimited/">Zip Unlimited</a><a href="/zip-solver/">Zip Solver</a><a href="/about/">About</a><a href="/contact/">Contact</a><a href="/privacy-policy/">Privacy</a><a href="/terms/">Terms</a></p>
<p>© {datetime.date.today().year} {SITE}. Free, unofficial practice puzzles. Not affiliated with, endorsed by or connected to LinkedIn Corporation or Microsoft. "Sumbreak", "Queens", "Tango" and "Zip" are used only to describe puzzle styles.</p>
</div></footer>
"""

def page(path, title, desc, body, scripts="", schema=None, noindex=False):
    html = head(title, desc, path, schema, noindex) + body + FOOT + scripts + ("" if noindex else ADS) + "\n</body>\n</html>\n"
    d = os.path.join(OUT, path.strip("/"))
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "index.html"), "w") as f:
        f.write(html)

def faq_schema(faqs):
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]}

def faq_html(faqs):
    return '<div class="faq">' + "".join(f"<details><summary>{q}</summary><p>{a}</p></details>" for q, a in faqs) + "</div>"

ADS = """<script>
/* Monetag vignette: loaded a few seconds after the page opens so the first view is never blocked.
   Vignette ads only appear when the visitor follows a link (e.g. "Next puzzle" after a win),
   never in the middle of a game. */
(function(){var load=function(){var s=document.createElement('script');s.dataset.zone='12312406';s.src='https://n6wxm.com/vignette.min.js';s.async=true;document.body.appendChild(s);};
if(document.readyState==='complete')setTimeout(load,4000);else window.addEventListener('load',function(){setTimeout(load,4000);});})();
</script>"""

GAME = """
<div id="game" data-default="{default}">
  <div class="levels" role="group" aria-label="Choose difficulty">
    <button type="button" data-level-btn="daily">Daily</button>
    <button type="button" data-level-btn="easy">Easy</button>
    <button type="button" data-level-btn="medium">Medium</button>
    <button type="button" data-level-btn="hard">Hard</button>
    <button type="button" data-level-btn="expert">Expert</button>
  </div>
  <div class="meta"><span data-puzzle-title>Loading…</span><span>⏱ <span data-timer>0:00</span> · Merges <span data-moves>0</span></span></div>
  <div class="board" aria-label="Puzzle board"></div>
  <p class="game-msg" aria-live="polite"></p>
  <div class="ctrl">
    <button type="button" data-action="undo">↶ Undo</button>
    <button type="button" data-action="restart">Restart</button>
    <button type="button" data-action="hint">💡 Hint</button>
    <button type="button" data-action="new">New puzzle →</button>
  </div>
  <p class="stats" data-stats></p>
</div>
<div class="modal" id="win-modal" hidden role="dialog" aria-modal="true" aria-labelledby="win-title">
  <div class="card">
    <h2 id="win-title" style="margin-top:0">🎉 Puzzle solved!</h2>
    <p data-win-text></p>
    <a class="btn primary" data-next href="#" style="text-decoration:none;display:inline-block">Next puzzle</a>
    <button type="button" class="btn" data-share>Share result</button>
    <button type="button" class="btn" data-close>Close</button>
    <p class="more-games">Try another game: <a href="/zip-unlimited/">Zip Unlimited</a> – one path through every square – <a href="/queens-unlimited/">Queens Unlimited</a> or <a href="/tango-unlimited/">Tango Unlimited</a>.</p>
  </div>
</div>
"""
GAME_JS = f'<script src="/assets/core.js?v={V}"></script>\n<script src="/assets/game.js?v={V}"></script>'

QGAME = """
<div id="qgame" data-default="{default}">
  <div class="levels" role="group" aria-label="Choose difficulty">
    <button type="button" data-level-btn="daily">Daily</button>
    <button type="button" data-level-btn="easy">Easy</button>
    <button type="button" data-level-btn="medium">Medium</button>
    <button type="button" data-level-btn="hard">Hard</button>
    <button type="button" data-level-btn="expert">Expert</button>
  </div>
  <div class="meta"><span data-puzzle-title>Loading…</span><span>⏱ <span data-timer>0:00</span></span></div>
  <div class="qboard" aria-label="Queens puzzle board"></div>
  <p class="game-msg" aria-live="polite"></p>
  <div class="ctrl">
    <button type="button" data-action="undo">↶ Undo</button>
    <button type="button" data-action="restart">Restart</button>
    <button type="button" data-action="hint">💡 Hint</button>
    <button type="button" data-action="new">New puzzle →</button>
  </div>
  <label class="autox"><input type="checkbox" data-autox> Auto ✕: cross out squares a queen rules out</label>
  <p class="stats" data-stats></p>
</div>
<div class="modal" id="win-modal" hidden role="dialog" aria-modal="true" aria-labelledby="win-title">
  <div class="card">
    <h2 id="win-title" style="margin-top:0">👑 Puzzle solved!</h2>
    <p data-win-text></p>
    <a class="btn primary" data-next href="#" style="text-decoration:none;display:inline-block">Next puzzle</a>
    <button type="button" class="btn" data-share>Share result</button>
    <button type="button" class="btn" data-close>Close</button>
    <p class="more-games">Try another game: <a href="/zip-unlimited/">Zip Unlimited</a> – one path through every square – <a href="/tango-unlimited/">Tango Unlimited</a> or <a href="/sumbreak-unlimited/">Sumbreak Unlimited</a>.</p>
  </div>
</div>
"""
QGAME_JS = f'<script src="/assets/queens-core.js?v={V}"></script>\n<script src="/assets/queens.js?v={V}"></script>'

TGAME = """
<div id="tgame" data-default="{default}">
  <div class="levels" role="group" aria-label="Choose difficulty">
    <button type="button" data-level-btn="daily">Daily</button>
    <button type="button" data-level-btn="easy">Easy</button>
    <button type="button" data-level-btn="medium">Medium</button>
    <button type="button" data-level-btn="hard">Hard</button>
    <button type="button" data-level-btn="expert">Expert</button>
  </div>
  <div class="meta"><span data-puzzle-title>Loading…</span><span>⏱ <span data-timer>0:00</span></span></div>
  <div class="tboard" aria-label="Tango puzzle board"></div>
  <p class="game-msg" aria-live="polite"></p>
  <div class="ctrl">
    <button type="button" data-action="undo">↶ Undo</button>
    <button type="button" data-action="restart">Restart</button>
    <button type="button" data-action="hint">💡 Hint</button>
    <button type="button" data-action="new">New puzzle →</button>
  </div>
  <p class="stats" data-stats></p>
</div>
<div class="modal" id="win-modal" hidden role="dialog" aria-modal="true" aria-labelledby="win-title">
  <div class="card">
    <h2 id="win-title" style="margin-top:0">☀️ Puzzle solved!</h2>
    <p data-win-text></p>
    <a class="btn primary" data-next href="#" style="text-decoration:none;display:inline-block">Next puzzle</a>
    <button type="button" class="btn" data-share>Share result</button>
    <button type="button" class="btn" data-close>Close</button>
    <p class="more-games">Try another game: <a href="/zip-unlimited/">Zip Unlimited</a> – one path through every square – <a href="/queens-unlimited/">Queens Unlimited</a> or <a href="/sumbreak-unlimited/">Sumbreak Unlimited</a>.</p>
  </div>
</div>
"""
TGAME_JS = f'<script src="/assets/tango-core.js?v={V}"></script>\n<script src="/assets/tango.js?v={V}"></script>'

ZGAME = """
<div id="zgame" data-default="{default}">
  <div class="levels" role="group" aria-label="Choose difficulty">
    <button type="button" data-level-btn="daily">Daily</button>
    <button type="button" data-level-btn="easy">Easy</button>
    <button type="button" data-level-btn="medium">Medium</button>
    <button type="button" data-level-btn="hard">Hard</button>
    <button type="button" data-level-btn="expert">Expert</button>
  </div>
  <div class="meta"><span data-puzzle-title>Loading…</span><span>⏱ <span data-timer>0:00</span></span></div>
  <div class="zboard" aria-label="Zip puzzle board"></div>
  <p class="game-msg" aria-live="polite"></p>
  <div class="ctrl">
    <button type="button" data-action="undo">↶ Undo</button>
    <button type="button" data-action="restart">Restart</button>
    <button type="button" data-action="hint">💡 Hint</button>
    <button type="button" data-action="new">New puzzle →</button>
  </div>
  <p class="stats" data-stats></p>
</div>
<div class="modal" id="win-modal" hidden role="dialog" aria-modal="true" aria-labelledby="win-title">
  <div class="card">
    <h2 id="win-title" style="margin-top:0">⚡ Puzzle solved!</h2>
    <p data-win-text></p>
    <a class="btn primary" data-next href="#" style="text-decoration:none;display:inline-block">Next puzzle</a>
    <button type="button" class="btn" data-share>Share result</button>
    <button type="button" class="btn" data-close>Close</button>
    <p class="more-games">Try another game: <a href="/tango-unlimited/">Tango Unlimited</a> – balance suns and moons – <a href="/queens-unlimited/">Queens Unlimited</a> or <a href="/sumbreak-unlimited/">Sumbreak Unlimited</a>.</p>
  </div>
</div>
"""
ZGAME_JS = f'<script src="/assets/zip-core.js?v={V}"></script>\n<script src="/assets/zip.js?v={V}"></script>'

def game_archive(launch, path):
    """Links to every past daily board of a game (query-string replays on the same page, not separate pages)."""
    days = (datetime.date.today() - launch).days + 1
    return '<ul class="archive">' + "".join(
        f'<li><a href="{path}?daily={n}">#{n} · {(launch + datetime.timedelta(days=n - 1)).isoformat()}{" (today)" if n == days else ""}</a></li>'
        for n in range(days, 0, -1)) + '</ul>'

def build():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    shutil.copytree(os.path.join(os.path.dirname(OUT), "assets"), os.path.join(OUT, "assets"))
    for f in ["favicon.svg", "og.png", "_headers", "_redirects", INDEXNOW_KEY + ".txt"]:
        src = os.path.join(os.path.dirname(OUT), "static", f)
        if os.path.exists(src):
            shutil.copy(src, OUT)

    # ---------- Sumbreak Unlimited (main page) ----------
    faqs = [
        ("What is Sumbreak Unlimited?", "Sumbreak Unlimited is a free, unofficial practice version of the Sumbreak-style number puzzle. Instead of one puzzle a day, you can play as many boards as you like in Easy, Medium, Hard and Expert, plus a free daily puzzle of our own with an archive of every past daily."),
        ("Is this the official LinkedIn Sumbreak game?", "No. The official game is played on LinkedIn. This site is an independent fan-made practice tool that uses the same simple idea (merging identical neighbouring numbers) and creates its own puzzles. We are not affiliated with LinkedIn."),
        ("How do you play Sumbreak?", "Drag a number onto an identical number right next to it (up, down, left or right). The two tiles combine into their sum, and the tile you moved leaves an empty dead spot. Keep merging until only one number is left on the board."),
        ("Can I play Sumbreak more than once a day?", "The official game gives one puzzle per day. Here you can play unlimited puzzles: every time you press New puzzle you get a fresh, solvable board."),
        ("Is every puzzle solvable?", "Yes. Every board is built backwards from a single finished tile, so there is always at least one correct order of merges. If you get stuck, use Undo or the Hint button."),
        ("Do I need an account or download?", "No. The game runs in your browser on phone, tablet or computer. There is no sign-up, and your stats are saved only on your own device."),
        ("What is the difference between Easy, Medium, Hard and Expert?", "Easy is a 3×3 board with plain numbers. Medium is 4×4 with one wildcard tile, Hard is 5×5 with two wildcards, and Expert is a big 6×6 board with 36 tiles and two wildcards."),
        ("What are the ×2 and +3 tiles?", "They are wildcard tiles. A wildcard can merge with any number next to it, not just an identical one: ×2 doubles the number and +3 adds three to it. The result is a normal number that then has to find its own identical partner."),
        ("Where should I start on a Sumbreak board?", "Start with the smallest numbers, especially any that sit on an edge or in a corner. They have the fewest neighbours, so they are the first tiles to get stranded. Then check that the merge you pick drops the result next to the number it has to meet next."),
        ("Why won't two numbers merge?", "Two plain numbers merge only when they are exactly the same and share a side. A 4 next to an 8 cannot merge, and neither can two 4s that only touch at a corner. If one of the tiles is a wildcard (×2 or +N) it can merge with any number it touches, but two wildcards can never merge with each other."),
        ("Can I play past daily puzzles?", "Yes. Every daily puzzle we have published is kept in the daily archive on our home page. Pick any number to replay it; solved ones get a tick. Archive games count towards your stats, but only today's puzzle extends your streak."),
        ("Does using a hint or undo affect my streak?", "No. Hints and undo are there to help you learn, so they never reset your streak or your stats. Your best time is simply the time on the clock when you finish."),
        ("Can I play with a keyboard?", "Yes. Press Tab to move between tiles, Enter or Space to pick a tile, then Enter or Space on a neighbour to merge. On touch screens you can drag, or tap one tile and then the other."),
        ("I'm stuck – what does the Hint button do?", "Hint highlights the next merge on a correct path. If your current position can no longer be finished, it takes you back to your last good position first and then shows the next merge, so you never have to restart from scratch."),
    ]
    game_schema = {
        "@context": "https://schema.org", "@type": ["VideoGame", "WebApplication"],
        "name": "Sumbreak Unlimited", "url": DOMAIN + "/sumbreak-unlimited/",
        "description": "Free unlimited Sumbreak-style number merge puzzles in the browser. Easy, Medium, Hard and a daily puzzle.",
        "applicationCategory": "GameApplication", "operatingSystem": "Any (web browser)",
        "genre": ["Puzzle", "Math puzzle", "Logic puzzle"], "gamePlatform": "Web browser", "playMode": "SinglePlayer",
        "isAccessibleForFree": True, "inLanguage": "en",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
        "publisher": {"@type": "Organization", "name": SITE, "url": DOMAIN}
    }
    body = f"""
<h1>Sumbreak Unlimited – Play Free Sumbreak Puzzles With No Daily Limit</h1>
<p class="lead">Merge identical neighbouring numbers until only one tile is left. Unlimited 3×3 to 6×6 boards with ×2 and +3 wildcard tiles, a free daily puzzle, hints and undo – no login needed.</p>
{GAME.format(default="easy")}
<div class="ad-slot"></div>

<h2>How to play Sumbreak Unlimited</h2>
<ol>
<li><strong>Find a pair.</strong> Look for two identical numbers that touch side by side or above and below each other. Diagonal tiles do not count.</li>
<li><strong>Merge them.</strong> Drag one number onto the other (or tap one, then tap the other). They combine into their sum: 4 + 4 becomes 8.</li>
<li><strong>Watch the dead spot.</strong> The tile you moved leaves an empty space behind. Empty spaces can never be filled again, so they can cut the board into pieces.</li>
<li><strong>Use wildcards wisely.</strong> Purple ×2 and +N tiles merge with <em>any</em> neighbouring number: ×2 doubles it, +3 adds three. Medium, Hard and Expert boards include them, just like the wildcard tiles in the newer official puzzles.</li>
<li><strong>Finish with one tile.</strong> The puzzle is solved when a single number remains. Every board here is guaranteed to have a solution.</li>
</ol>
<p>New to the puzzle? Read our full <a href="/how-to-play-sumbreak/">Sumbreak rules and strategy guide</a>. Stuck on today's official board? Type it into the <a href="/sumbreak-solver/">Sumbreak solver</a> to get the answer step by step.</p>

<h2>Why play unlimited Sumbreak puzzles?</h2>
<p>The daily version is over in a minute or two, and then you have to wait until midnight Pacific Time for the next one. Practising here helps you spot the patterns that matter – which small numbers to clear first, which merges leave a tile stranded, and when to merge <em>towards</em> the big numbers instead of away from them. Players who practise a few boards usually solve the daily puzzle faster and with fewer mistakes.</p>

<h2>Features</h2>
<ul>
<li><strong>Unlimited puzzles</strong> in four difficulty levels – 3×3, 4×4, 5×5 and a 6×6 Expert board – each with its own puzzle number you can share.</li>
<li><strong>Wildcard tiles</strong> (×2 and +1 to +3) on Medium, Hard and Expert, so you can practise the trickiest part of the real game.</li>
<li><strong>Daily puzzle</strong> – one shared board for everyone each day, with a streak counter and an <a href="/#archive">archive of every past daily</a> to replay.</li>
<li><strong>Hint, Undo and Restart</strong> so you can learn instead of guessing. Hint also rewinds you to your last good position when you hit a dead end.</li>
<li><strong>Timer and best times</strong> saved on your device.</li>
<li><strong>Works everywhere</strong> – drag on touch screens, click or use the keyboard on desktop.</li>
</ul>

<h2>Quick tips</h2>
<ul>
<li>Clear the <strong>smallest numbers first</strong>. A 1 or 2 that ends up alone can never be merged, because no new small numbers are ever created.</li>
<li>Count each value: an <strong>odd number of the smallest tile</strong> on the board means something has already gone wrong.</li>
<li>Before each merge, check that you are not <strong>cutting the board in two</strong> with a new dead spot.</li>
<li>Merge so the result lands <strong>next to a matching number</strong>, keeping chains going.</li>
<li>Treat a <strong>wildcard as a rescue tool</strong>: look for the one number on the board that has no possible partner (an odd one like 13, or a lonely 8 surrounded by bigger tiles) – that is usually where the wildcard belongs.</li>
<li>Remember that <strong>two wildcards never merge</strong> with each other, so don't let them end up side by side with no number around them.</li>
</ul>

<h2>Worked example: using a ×2 wildcard</h2>
<p>Imagine a corner that reads <code>4 4 / ×2 16</code>. Merging the two 4s first gives 8, but then the ×2 has to double that 8 into 16 to meet the 16 – so the order matters: merge the right-hand 4 onto the left-hand 4 so the new 8 sits directly above the wildcard, then drag that 8 onto the ×2. The 16 lands where the wildcard was – right next to the other 16 – and the last merge makes 32. If you had used the ×2 on one of the 4s first, you would be left with an 8 and a 4 that can never meet. Wildcards are powerful, but only at the right moment.</p>

<h2>Frequently asked questions</h2>
{faq_html(faqs)}
<p class="disclaimer">Unlimited Dailies is an independent website. It is not affiliated with, sponsored by or endorsed by LinkedIn Corporation or Microsoft. All puzzles on this page are generated by our own code.</p>
"""
    page("/sumbreak-unlimited/", "Sumbreak Unlimited – Free Sumbreak Puzzles, No Daily Limit",
         "Play Sumbreak unlimited for free: merge numbers until one tile is left. 3×3 to 6×6 boards, ×2 and +3 wildcards, daily puzzle, hints and undo. No login.",
         body, GAME_JS, [game_schema, faq_schema(faqs)])

    # ---------- Solver ----------
    sfaqs = [
        ("How do I get today's Sumbreak answer?", "Open today's puzzle on LinkedIn, choose the matching board size here, type each number into the same position (leave dead spots blank) and press Solve. You will get the full list of merges in order."),
        ("Why does the solver say there is no solution?", "Usually one number was typed in the wrong cell or a wildcard is missing. On boards without wildcards, all the numbers add up to a power of two such as 64, 128, 256 or 512 – a quick way to check your typing."),
        ("Does the solver handle the ×2 and +3 wildcard tiles?", "Yes. Type a wildcard as x2, ×2 or +3 (or use the wildcard buttons under the grid). The solver knows that a wildcard can merge with any neighbouring number and that two wildcards cannot merge with each other."),
        ("What board sizes are supported?", "Every size from 3×3 up to 6×6, including rectangular boards such as 4×5 and 5×6. Leave empty or dead spots blank."),
        ("Can I see just one hint instead of the whole answer?", "Yes. After you press Solve, only the first merge is shown. Press Show next step to reveal one more merge at a time, or Show all steps for the full answer."),
        ("Does the solver work for unlimited puzzles too?", "Yes. It works for any board that follows the merge rules: identical numbers that touch up, down, left or right combine into their sum, and wildcards change any number they touch."),
        ("Is using the solver cheating?", "That is up to you. Many players only reveal the first step or two, then finish the puzzle themselves. If you want practice instead, play our unlimited boards."),
    ]
    body = f"""
<h1>Sumbreak Solver – Today's Sumbreak Answer, Step by Step</h1>
<p class="lead">Stuck on the daily Sumbreak puzzle? Type the board below – wildcards included – and get every merge in the right order, one hint at a time if you prefer.</p>
<form id="solver" class="card" autocomplete="off">
  <label>Board size:
    <select name="size"><option>3x3</option><option>3x4</option><option>4x3</option><option>4x4</option><option>4x5</option><option>5x4</option><option>5x5</option><option>5x6</option><option>6x5</option><option>6x6</option></select>
  </label>
  <div class="solver-grid"></div>
  <div class="op-bar" aria-label="Insert a wildcard into the selected cell"><span style="font-size:.9rem;color:var(--muted);align-self:center">Wildcard:</span><button type="button" data-op="x2">×2</button><button type="button" data-op="x3">×3</button><button type="button" data-op="+1">+1</button><button type="button" data-op="+2">+2</button><button type="button" data-op="+3">+3</button><button type="button" data-op="">Clear cell</button></div>
  <p style="font-size:.9rem;color:var(--muted)">Type numbers, wildcards as x2 or +3, and leave empty / dead spots blank. Rows go top to bottom, columns left to right.</p>
  <button class="btn primary" type="submit">Solve</button>
  <button class="btn" type="button" data-example>Load example</button>
  <button class="btn" type="button" data-clear>Clear</button>
</form>
<div id="solver-out" aria-live="polite"></div>
<div class="ad-slot"></div>

<h2>Stuck on today's Sumbreak? Get the answer in three steps</h2>
<ol>
<li><strong>Pick the board size</strong> that matches the puzzle on your screen (most daily boards so far are 3×3).</li>
<li><strong>Copy the tiles</strong> row by row. Numbers go in as they are; wildcard tiles go in as x2 or +3 – the buttons under the grid make this quick on a phone. If you have already made some merges, just enter what is left and leave the empty squares blank.</li>
<li><strong>Press Solve</strong> and reveal one step at a time, or the whole answer at once. Each step shows a small picture of the board with the two tiles to merge highlighted.</li>
</ol>

<h2>How the Sumbreak solver works</h2>
<p>The solver tries merges the same way you would, but much faster. It starts with the smallest numbers, because those are the tiles most likely to get stranded, and skips any position that cannot be finished – for example when a dead spot splits the board in two, or when an odd number of the smallest tile is left. As soon as it finds an order of merges that ends in one tile, it shows you the full path.</p>
<p>Wildcard tiles make the search harder, because a ×2 or +3 can join any number and therefore opens many more possible moves. The solver handles this by checking the numbers first: if the smallest number on the board has neither an identical partner nor a wildcard left to use, that branch is dropped straight away. It also spots tiles that can never move again – for example a 4 that is surrounded only by bigger numbers and empty squares. The search runs in the background of your browser, so the page stays responsive even on 6×6 boards.</p>
<h2>Worked example: a 3×3 board in eight merges</h2>
<p>Here is a small board we made for this page: <code>2 2 4 / 8 16 4 / 8 16 4</code>. Its numbers add up to 64, a power of two, so a full solution is possible. The solver's answer shows why order matters:</p>
<ol>
<li>Merge the two 2s in the top row into the middle square: now <code>· 4 4</code>.</li>
<li>Merge that 4 into the top-right 4, making 8 in the corner.</li>
<li>Merge the bottom-right 4 up into the 4 in the middle of the right column, making 8 there.</li>
<li>Drop the corner 8 onto that 8: the right column now holds a single 16 in its middle square.</li>
<li>Merge the two 8s in the left column, making 16 at the bottom left.</li>
<li>Merge the right-hand 16 into the centre 16, making 32 in the centre.</li>
<li>Merge the bottom-left 16 into the bottom-middle 16, making 32 below the centre.</li>
<li>Merge the centre 32 down onto it: one tile, 64. Solved.</li>
</ol>
<p>Notice that the solver starts with the smallest tiles and keeps every new number next to a partner. Merge the two 16s in the middle column first instead and the board can no longer be finished – the 32 is left without a partner it can ever reach, and the solver will tell you there is no solution. Press <em>Load example</em> above and then <em>Solve</em> to watch the same order with a picture of the board for every step.</p>
<h2>Want to get better instead?</h2>
<p>Practise with unlimited boards in <a href="/sumbreak-unlimited/">Sumbreak Unlimited</a>, or read the <a href="/how-to-play-sumbreak/">strategy guide</a> to learn the patterns the solver uses.</p>
<h2>FAQ</h2>
{faq_html(sfaqs)}
<p class="disclaimer">Unofficial tool. Not affiliated with LinkedIn. The solver runs entirely in your browser; the numbers you type are not sent anywhere.</p>
"""
    page("/sumbreak-solver/", "Sumbreak Solver – Today's Answer, Free & Step by Step",
         "Stuck on today's Sumbreak? Type your board (×2 and +3 wildcards too) and get the answer free, one merge at a time or all at once. 3×3 to 6×6, no sign-up.",
         body, f'<script src="/assets/core.js?v={V}"></script>\n<script src="/assets/solver.js?v={V}"></script>',
         [faq_schema(sfaqs), {"@context": "https://schema.org", "@type": "WebApplication", "name": "Sumbreak Solver",
          "url": DOMAIN + "/sumbreak-solver/", "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any",
          "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}])

    # ---------- How to play ----------
    hfaqs = [
        ("Can tiles merge diagonally in Sumbreak?", "No. Only tiles that share a side – up, down, left or right – can be merged."),
        ("Can you merge two different numbers?", "Not two plain numbers. A 4 can merge with a 4 to make 8, but never with a 2 or an 8. The only exception is a wildcard tile such as ×2 or +3, which can merge with any number."),
        ("What happens to the tile you drag?", "It disappears and leaves an empty dead spot. The sum appears where you dropped it."),
        ("What is the final number in Sumbreak?", "On a board without wildcards it is the total of all numbers on the starting board, which is always a power of two (for example 128 in the first puzzle). Wildcard tiles change the total, so on those boards the final number is worked out as you play."),
        ("How do wildcard tiles work in Sumbreak?", "A wildcard such as ×2 or +3 merges with any number next to it and applies its operation to that number. Two wildcards cannot merge together, and the resulting number then needs an identical neighbour as usual."),
        ("When does Sumbreak reset?", "The official LinkedIn puzzle changes every day at midnight Pacific Time. Our unlimited boards never run out."),
    ]
    body = f"""
<h1>How to Play Sumbreak: Rules, Tips and Strategy</h1>
<p class="lead">Everything you need to solve Sumbreak-style merge puzzles – from the basic rules to the tricks that stop you getting stuck.</p>
<p><a class="btn primary" href="/sumbreak-unlimited/" style="text-decoration:none;display:inline-block">▶ Practise now – unlimited puzzles</a></p>

<h2>What is Sumbreak?</h2>
<p>Sumbreak is a daily math-and-logic puzzle that launched on LinkedIn on 18 November 2026. You start with a grid of numbered tiles. Merging two identical neighbours adds them together, and you win when only one tile is left. It feels a little like 2048, but there is no sliding and no luck: every move is your choice, and one careless merge can leave a number with no partner.</p>

<h2>The rules</h2>
<ol>
<li>You may merge two number tiles only if they show the <strong>same number</strong> (wildcard tiles are the exception – see below).</li>
<li>The two tiles must be <strong>orthogonal neighbours</strong> – sharing a side, not just a corner.</li>
<li>Drag one tile onto the other. The target becomes the <strong>sum</strong>; the tile you dragged becomes an <strong>empty dead spot</strong>.</li>
<li>Dead spots stay empty for the rest of the puzzle. Tiles never slide or fall.</li>
<li>The puzzle is solved when exactly <strong>one tile</strong> remains.</li>
</ol>

<h2>Wildcard tiles (×2 and +3)</h2>
<p>Some puzzles include special wildcard tiles that show an operation instead of a number, such as <strong>×2</strong> or <strong>+3</strong>. They follow slightly different rules:</p>
<ul>
<li>A wildcard can merge with <strong>any number</strong> it touches – the numbers do not have to match.</li>
<li>The operation is applied to that number: ×2 turns an 8 into 16, +3 turns a 5 into 8. The new number lands on the square you dropped onto, and the wildcard is used up.</li>
<li>Two wildcards can never merge with each other.</li>
<li>After a wildcard is used, the new number follows the normal rules again and needs an identical neighbour.</li>
</ul>
<p>Because wildcards change the total, the final tile is no longer simply the sum of the board. The trick is to find the number that has no natural partner – often an odd number or a lone tile – and save the wildcard for it. You can practise wildcard boards on Medium, Hard and Expert in <a href="/sumbreak-unlimited/">Sumbreak Unlimited</a>.</p>

<h2>Strategy guide</h2>
<h3>1. Start with the smallest numbers</h3>
<p>No move ever creates a small number – merges only make bigger ones. So if a 1 or a 2 is left without a partner, the puzzle is lost. Pair up the smallest tiles early while they still have neighbours.</p>
<h3>2. Count before you merge</h3>
<p>The smallest value on the board must always appear an even number of times (unless only one tile is left). If you count three 2s and no 1s, one of those 2s can never be paired – undo and try another route.</p>
<h3>3. Don't split the board</h3>
<p>Every merge leaves a dead spot. If the dead spots form a wall that cuts the tiles into two separate groups, those groups can never join again. Before merging, ask: will the tile I'm moving away from still be connected?</p>
<h3>4. Choose which tile moves</h3>
<p>Merging A onto B is not the same as merging B onto A. The result stays where you drop it, and the empty spot appears where you started. Drop the result next to the number it needs to meet next, and move the tile that sits on the edge or in a corner.</p>
<h3>5. Work towards the big tile</h3>
<p>Large numbers (like 64 or 256) usually can't move until late in the puzzle. Build matching numbers next to them, step by step, instead of dragging small tiles far away from the big ones.</p>
<h3>6. Check the total</h3>
<p>On boards without wildcards, add up all the numbers. The final tile will be that total, and it is always a power of two. This also helps you check that you copied a board correctly into the <a href="/sumbreak-solver/">solver</a>.</p>

<h2>Worked example: which tile should move?</h2>
<p>Picture a row that reads <code>2 2 4</code>, with nothing else touching those three tiles. Both 2s can merge, but the direction decides whether you can carry on:</p>
<ul>
<li><strong>Drag the middle 2 onto the left 2:</strong> the new 4 appears on the far left and the middle square becomes a dead spot. Now the two 4s are separated by a hole and can never meet – a dead end.</li>
<li><strong>Drag the left 2 onto the middle 2:</strong> the new 4 appears in the middle, right next to the other 4. One more merge makes 8, and the row is finished.</li>
</ul>
<p>The rule of thumb: move the tile that is <em>further away</em> from the number the result needs to meet next, so the sum lands on the side that keeps the chain going.</p>

<h2>Worked example: a full board</h2>
<p>Take the board <code>1 1 64 / 4 2 32 / 4 4 16</code> (total 128). First merge the two 1s into a 2 – it now sits next to the other 2. Merge those into a 4, then pair up the 4s into 8s and 16s, building up to 32 and 64 until a single 128 remains. Try it yourself in the <a href="/sumbreak-solver/">solver</a> using <em>Load example</em>.</p>

<h2>Daily puzzle or unlimited practice?</h2>
<p>The official game gives you one board a day, and so does our own <a href="/">free daily puzzle</a>, which keeps a streak if you come back every day. If you missed a day, replay it from the <a href="/#archive">daily archive</a>. When you want to practise a specific skill – wildcards, big 6×6 boards or simply speed – switch to <a href="/sumbreak-unlimited/">Sumbreak Unlimited</a> and play as many boards as you like at the level you choose.</p>

<h2>FAQ</h2>
{faq_html(hfaqs)}
<p class="disclaimer">This guide is written by Unlimited Dailies and is not affiliated with LinkedIn. Rules are described as they appear in the public game.</p>
"""
    page("/how-to-play-sumbreak/", "How to Play Sumbreak – Rules, Tips & Strategy Guide",
         "Learn how to play Sumbreak, LinkedIn's daily number-merge puzzle: rules, ×2 and +3 wildcard tiles, dead spots and strategy tips to stop getting stuck.",
         body, "", [faq_schema(hfaqs), {"@context": "https://schema.org", "@type": "Article",
          "headline": "How to Play Sumbreak – Rules, Tips & Strategy Guide", "datePublished": TODAY, "dateModified": TODAY,
          "author": {"@type": "Organization", "name": SITE}, "publisher": {"@type": "Organization", "name": SITE},
          "mainEntityOfPage": DOMAIN + "/how-to-play-sumbreak/"}])

    # ---------- Queens Unlimited ----------
    qfaqs = [
        ("What is Queens Unlimited?", "Queens Unlimited is a free, unofficial practice version of the Queens-style logic puzzle. You place one queen in every row, every column and every coloured region, and no two queens may touch. Instead of one board a day, you can play as many boards as you like from 6×6 to 10×10, plus a free daily board of our own."),
        ("Is this the official LinkedIn Queens game?", "No. The official Queens game is played on LinkedIn. This site is an independent practice tool that uses the same well-known rules (a variant of the classic star battle puzzle) and creates every board with its own generator. We are not affiliated with LinkedIn."),
        ("What are the rules of Queens?", "Place exactly one queen in each row, each column and each coloured region. Queens may not touch each other – not side by side and not diagonally. The puzzle is solved when the board holds one queen per row, column and colour."),
        ("Can I play Queens more than once a day?", "Yes. The official game gives one board per day, but here every press of New puzzle creates a fresh board, so you can play unlimited Queens puzzles at any level."),
        ("Does every board have only one solution?", "Yes. Each board is checked by our solver before you see it, and it is only used if exactly one arrangement of queens works. That means you can always solve it by logic, without guessing."),
        ("What are the ✕ marks for?", "Tap a square once to mark it with ✕ when you know a queen cannot go there. Tap again to place a queen, and a third time to clear the square. You can also drag across several squares to mark them all with ✕ in one go."),
        ("What is the difference between the levels?", "Easy is a 6×6 board, Medium 7×7, Hard 9×9 and Expert a big 10×10 board. The daily puzzle is 8×8. Bigger boards have more regions and longer chains of deductions."),
        ("What does the Hint button do?", "If you have a queen or ✕ in the wrong place, Hint clears that mistake first. Otherwise it places one correct queen in the smallest unsolved region, which is usually where a human solver would look next."),
        ("What does Auto ✕ do?", "When Auto ✕ is switched on, placing a queen automatically crosses out its row, its column, its colour region and the eight squares around it. It saves taps on big boards; switch it off if you prefer to do every deduction yourself."),
        ("Do hints or undo affect my stats?", "Undo never affects anything. Hints are counted only in the result you share, so you can be honest with friends; your solved count and streak still go up."),
        ("Is there a Queens solver?", "Yes. If you are stuck on a board, open our Queens solver, colour the regions to match your puzzle and it shows the queens one at a time."),
    ]
    qgame_schema = {
        "@context": "https://schema.org", "@type": ["VideoGame", "WebApplication"],
        "name": "Queens Unlimited", "url": DOMAIN + "/queens-unlimited/",
        "description": "Free unlimited Queens-style logic puzzles in the browser: one queen per row, column and colour region. 6×6 to 10×10 boards and a daily puzzle.",
        "applicationCategory": "GameApplication", "operatingSystem": "Any (web browser)",
        "genre": ["Puzzle", "Logic puzzle"], "gamePlatform": "Web browser", "playMode": "SinglePlayer",
        "isAccessibleForFree": True, "inLanguage": "en",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
        "publisher": {"@type": "Organization", "name": SITE, "url": DOMAIN}
    }
    body = f"""
<h1>Queens Unlimited – Play Free Queens Puzzles With No Daily Limit</h1>
<p class="lead">Place one queen in every row, column and colour – without any two queens touching. Unlimited 6×6 to 10×10 boards, a free daily puzzle, hints and undo. No login, no download.</p>
{QGAME.format(default="easy")}
<div class="ad-slot"></div>

<h2>How to play Queens</h2>
<ol>
<li><strong>One queen per row and column.</strong> Every horizontal row and every vertical column ends up with exactly one queen.</li>
<li><strong>One queen per colour.</strong> The board is split into coloured regions, and each region gets exactly one queen too.</li>
<li><strong>Queens never touch.</strong> No queen may sit next to another one – not beside it, above it, below it or diagonally on any of the eight surrounding squares.</li>
<li><strong>Mark what you rule out.</strong> Tap once to put ✕ on a square that cannot hold a queen, tap twice to place a queen. Drag across squares to cross out a whole row or region quickly.</li>
<li><strong>Finish the board.</strong> When every row, column and colour has its queen and nothing clashes, the puzzle is solved. Clashing queens turn red so you notice mistakes at once.</li>
</ol>
<p>Stuck on a board – maybe today's official one? Colour it into the <a href="/queens-solver/">Queens solver</a> and reveal the answer one queen at a time.</p>

<h2>Why practise with unlimited Queens puzzles?</h2>
<p>The daily Queens board on LinkedIn takes most players a minute or two, and then the wait for tomorrow begins. The fastest solvers are not quicker because they guess better – they recognise a handful of patterns instantly: a region squeezed into a single row, two regions sharing the same two columns, a square that would block a whole region. The only way to learn those patterns is to see a lot of boards. Here every board is new, every board has exactly one solution, and you can pick the size that matches what you want to train.</p>

<h2>Features</h2>
<ul>
<li><strong>Unlimited boards</strong> in four sizes – 6×6, 7×7, 9×9 and a 10×10 Expert board – each with a puzzle number you can share.</li>
<li><strong>Always one solution</strong>: every board is checked by our solver before it reaches you, so it can be solved with pure logic.</li>
<li><strong>Daily Queens puzzle</strong> – one 8×8 board for everyone each day, with a streak counter.</li>
<li><strong>✕ marks, drag-to-mark, optional Auto ✕, Undo, Restart and Hint</strong>, plus red highlighting when two queens clash.</li>
<li><strong>Timer, best times and a share button</strong> to post your result to friends or colleagues.</li>
<li><strong>Keyboard play</strong>: arrow keys to move, Q for a queen, X for a mark, Enter to cycle.</li>
</ul>

<h2>Queens daily archive</h2>
<p>Missed a day? Every daily 8×8 Queens board we have published stays playable here. Archive boards count towards your solved total and best time; only today's board extends your streak.</p>
{game_archive(datetime.date(2026, 11, 24), "/queens-unlimited/")}

<h2>Queens strategy: five techniques that solve most boards</h2>
<h3>1. Start with the smallest region</h3>
<p>A region with only two or three squares leaves very few options. If all its squares sit in one row, the queen of that row must be inside that region – so you can cross out every other square of the row.</p>
<h3>2. Regions locked into a line</h3>
<p>The same idea works for columns, and for groups: if two regions fit entirely inside the same two rows, those two rows are "used up" by them. Every other square in those two rows can be marked with ✕.</p>
<h3>3. Cross out the neighbours of every queen</h3>
<p>As soon as you place a queen, mark its row, its column, its region and all eight squares around it. Our drag-to-mark makes this fast. Many boards then fall like dominoes.</p>
<h3>4. Test a square by its consequences</h3>
<p>When a square looks possible, imagine a queen there and see what it would cover. If it would wipe out every remaining square of some other region, that square must be ✕. This "what would it block?" check is the key to Hard and Expert boards.</p>
<h3>5. Count what is left</h3>
<p>Near the end, count open rows, columns and regions. If one region has squares in only one open column, its queen is forced. Counting is also a quick way to notice a mistake before the board turns red.</p>

<h2>Worked example: a two-square region</h2>
<p>Suppose a small yellow region covers just two squares, side by side in row 3. Whichever of the two holds the queen, row 3 is now spoken for, so every other square in row 3 gets an ✕. And because the two squares are neighbours, the squares directly above and below <em>both</em> of them touch the queen either way – so those can be crossed out too. One tiny region has just removed up to a dozen squares, without placing a single queen.</p>

<h2>Frequently asked questions</h2>
{faq_html(qfaqs)}
<p class="disclaimer">Unlimited Dailies is an independent website. It is not affiliated with, sponsored by or endorsed by LinkedIn Corporation or Microsoft. "Queens" is used only to describe the puzzle style. All boards on this page are generated by our own code.</p>
"""
    page("/queens-unlimited/", "Queens Unlimited – Free Queens Puzzles, No Daily Limit",
         "Play Queens unlimited for free: one queen per row, column and colour region. 6×6 to 10×10 boards, a daily puzzle, hints and undo. No login needed.",
         body, QGAME_JS, [qgame_schema, faq_schema(qfaqs)])

    # ---------- Queens solver ----------
    qsfaqs = [
        ("How do I get the answer to today's Queens puzzle?", "Choose the board size that matches your puzzle, pick a colour and paint each region of the grid the same way it looks in the game (drag across squares to paint quickly). Press Solve and the solver reveals one queen at a time, or all of them at once."),
        ("Do my colours have to match the official colours?", "No. Only the shape of each region matters. Use any colour for any region – just make sure squares that belong to the same region get the same colour and that you use exactly as many colours as there are rows."),
        ("Why does the solver say there is no solution?", "Almost always one square was painted with the wrong colour. Compare the board row by row with your puzzle, fix the square and press Solve again."),
        ("What sizes does the Queens solver support?", "Every square board from 5×5 up to 11×11, which covers all common Queens and star battle puzzles with one queen per row."),
        ("Can I get a hint instead of the full answer?", "Yes. After you press Solve, only one queen is shown – the one in the smallest region, where you would usually start. Press Show next queen to reveal more, one at a time."),
        ("Is my board sent anywhere?", "No. The solver runs completely in your browser. Nothing you paint is uploaded or saved on our servers."),
    ]
    body = f"""
<h1>Queens Solver – Today's Queens Answer, One Queen at a Time</h1>
<p class="lead">Stuck on a Queens puzzle? Paint the colour regions below, press Solve, and reveal the queens one by one – or all at once.</p>
<form id="qsolver" class="card" autocomplete="off">
  <label>Board size:
    <select name="size"><option value="5">5×5</option><option value="6">6×6</option><option value="7">7×7</option><option value="8" selected>8×8</option><option value="9">9×9</option><option value="10">10×10</option><option value="11">11×11</option></select>
  </label>
  <div class="qpalette" aria-label="Choose a colour to paint with"></div>
  <div class="qboard" aria-label="Paint the regions of your puzzle"></div>
  <p style="font-size:.9rem;color:var(--muted)">Pick a colour, then tap or drag over the squares of one region. Repeat for every region. Colours do not have to match the game – only the shapes matter.</p>
  <button class="btn primary" type="submit">Solve</button>
  <button class="btn" type="button" data-example>Load example</button>
  <button class="btn" type="button" data-clear>Clear</button>
</form>
<div id="qsolver-out" aria-live="polite"></div>
<div class="ad-slot"></div>

<h2>Stuck on today's Queens? Get the answer in three steps</h2>
<ol>
<li><strong>Pick the size.</strong> Count the rows of your puzzle – daily boards are usually between 7×7 and 10×10 – and choose that size.</li>
<li><strong>Paint the regions.</strong> Choose colour 1 and paint every square of one region, then colour 2 for the next region, and so on. Dragging your finger or mouse paints many squares at once; the eraser fixes slips.</li>
<li><strong>Press Solve.</strong> The first queen appears on the board. Use <em>Show next queen</em> if you only want a nudge, or <em>Show all queens</em> for the full answer.</li>
</ol>

<h2>How the Queens solver works</h2>
<p>The solver places queens row by row. In each row it only tries columns that are still free, in regions that do not have a queen yet, and never next to the queen in the row above. After every placement it checks that each region without a queen still has at least one usable square further down the board; if one does not, that whole branch is dropped immediately. This pruning means even an 11×11 board is solved in a fraction of a second on a phone.</p>
<p>The solver also keeps looking for a second solution. Real Queens puzzles have exactly one answer, so if your board has more than one, the solver tells you – a strong sign that a square was painted with the wrong colour.</p>
<p>When it shows the answer, it starts with the queen in the smallest region. That is the same place a good human solver looks first, so revealing a single queen is often enough to get you going again.</p>

<h2>Solve it yourself next time</h2>
<p>Three habits solve most boards without help: start with the smallest region, cross out the row and column of any region that sits completely in one line, and after every queen mark all eight squares around it. Practise them on fresh boards in <a href="/queens-unlimited/">Queens Unlimited</a> – every board there is checked to have exactly one solution.</p>

<h2>FAQ</h2>
{faq_html(qsfaqs)}
<p class="disclaimer">Unofficial tool. Not affiliated with LinkedIn. The solver runs entirely in your browser; your board is not sent anywhere.</p>
"""
    page("/queens-solver/", "Queens Solver – Today's Queens Answer, Step by Step",
         "Free Queens solver: paint your board's colour regions and reveal the answer one queen at a time. Works for 5×5 to 11×11 Queens and star battle boards.",
         body, f'<script src="/assets/queens-core.js?v={V}"></script>\n<script src="/assets/queens-solver.js?v={V}"></script>',
         [faq_schema(qsfaqs), {"@context": "https://schema.org", "@type": "WebApplication", "name": "Queens Solver",
          "url": DOMAIN + "/queens-solver/", "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any",
          "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}])

    # ---------- Tango Unlimited ----------
    SUN = '<span class="sym-sun" aria-label="sun"></span>'
    MOON = '<span class="sym-moon" aria-label="moon"></span>'
    tfaqs = [
        ("What is Tango Unlimited?", "Tango Unlimited is a free, unofficial practice version of the Tango-style sun and moon logic puzzle. You fill a grid so every row and column has the same number of suns and moons, never three of a kind in a row, and every = or × sign between two squares is respected. Instead of one board a day you can play as many as you like, plus a free daily board of our own."),
        ("Is this the official LinkedIn Tango game?", "No. The official Tango game is played on LinkedIn. This site is an independent practice tool that uses the same well-known binary-grid rules (also known as Takuzu or binary puzzles) and creates every board with its own generator. We are not affiliated with LinkedIn."),
        ("What are the rules of Tango?", "Fill every square with a sun or a moon. Each row and each column must contain the same number of suns and moons (three of each on a 6×6 board). No more than two identical symbols may be next to each other in a row or column. Two squares joined by = must be the same, and two squares joined by × must be opposite."),
        ("What does the × sign mean in Tango?", "× means the two squares it sits between must hold different symbols: one sun and one moon. It does not tell you which one goes where – you find that out from the rest of the row or column."),
        ("Can I play Tango more than once a day?", "Yes. The official game gives one board per day, but here every press of New puzzle creates a fresh board, so you can play unlimited Tango puzzles at four difficulty levels."),
        ("Does every board have exactly one solution?", "Yes. Every board is checked by our logic solver before you see it. It is only used if it can be completed square by square without guessing, which also proves that the answer is unique."),
        ("What is the difference between the levels?", "Easy, Medium and Hard are 6×6 boards like the daily puzzle on LinkedIn: Easy starts with many symbols filled in, Medium with fewer, and Hard with only the minimum needed. Expert is a bigger 8×8 board with four suns and four moons per line."),
        ("What does the Hint button do?", "If a symbol you placed is wrong, Hint removes it first. Otherwise it fills one square that can be worked out right now and tells you which row or column proves it, so you learn the reasoning instead of just copying an answer."),
        ("Do hints or undo affect my stats?", "Undo never affects anything. Hints are shown in the result you share, but your solved count, best times and daily streak still go up."),
        ("Can I play with a keyboard?", "Yes. Use the arrow keys to move, press S or 1 for a sun, M or 2 for a moon, and Backspace to clear a square. Tapping or clicking cycles sun → moon → empty."),
        ("How is Tango different from Queens and Sumbreak?", "Tango is about balance: two symbols, equal counts per line and = / × signs between squares. <a href=\"/queens-unlimited/\">Queens</a> is about placement: one queen per row, column and colour region, with no two queens touching. <a href=\"/sumbreak-unlimited/\">Sumbreak</a> is a number puzzle where you merge equal neighbours until one tile is left. All three are logic puzzles you can play free and unlimited here."),
        ("Is there a Tango solver?", "Yes. If you are stuck, open our Tango solver, enter the suns, moons and signs from your board and it fills the grid one square at a time, explaining which row or column forces each step."),
    ]
    tgame_schema = {
        "@context": "https://schema.org", "@type": ["VideoGame", "WebApplication"],
        "name": "Tango Unlimited", "url": DOMAIN + "/tango-unlimited/",
        "description": "Free unlimited Tango-style sun and moon logic puzzles in the browser: balance every row and column, never three in a row, follow the = and × signs. 6×6 and 8×8 boards and a daily puzzle.",
        "applicationCategory": "GameApplication", "operatingSystem": "Any (web browser)",
        "genre": ["Puzzle", "Logic puzzle"], "gamePlatform": "Web browser", "playMode": "SinglePlayer",
        "isAccessibleForFree": True, "inLanguage": "en",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
        "publisher": {"@type": "Organization", "name": SITE, "url": DOMAIN}
    }
    body = f"""
<h1>Tango Unlimited – Play Free Tango Puzzles With No Daily Limit</h1>
<p class="lead">Fill the grid with suns and moons: the same number of each in every row and column, never three in a row, and every = and × sign respected. Unlimited boards, a free daily puzzle, hints that explain themselves – no login.</p>
{TGAME.format(default="easy")}
<div class="ad-slot"></div>

<h2>How to play Tango</h2>
<ol>
<li><strong>Fill every square.</strong> Tap a square once for a sun {SUN}, twice for a moon {MOON}, and a third time to clear it. Squares with a grey background are given and cannot be changed.</li>
<li><strong>Balance each line.</strong> Every row and every column needs exactly as many suns as moons – three of each on a 6×6 board, four of each on the 8×8 Expert board.</li>
<li><strong>Never three in a row.</strong> Two identical symbols may sit side by side, but a third one next to them, horizontally or vertically, breaks the rule.</li>
<li><strong>Follow the signs.</strong> An <strong>=</strong> between two squares means they hold the same symbol; a <strong>×</strong> means they hold opposite symbols.</li>
<li><strong>Finish the grid.</strong> Anything that breaks a rule is striped in red at once, and the puzzle is solved the moment the last square is filled correctly.</li>
</ol>
<p>Stuck on a board – maybe today's official one? Enter it into the <a href="/tango-solver/">Tango solver</a> and reveal the answer one square at a time, with the reason for each step.</p>

<h2>Why practise with unlimited Tango puzzles?</h2>
<p>The daily Tango board takes most people a minute or two, and fast players finish in well under thirty seconds. They are not guessing faster – they spot a few patterns instantly: a pair that must be closed off on both ends, a gap between two equal symbols, a line that already has its three suns. Seeing those patterns takes repetition, and one board a day is not much of it. Here every board is fresh, every board has exactly one answer that can be found without guessing, and you can choose how much help the board gives you at the start.</p>

<h2>Features</h2>
<ul>
<li><strong>Unlimited boards</strong> at four levels – Easy, Medium and Hard 6×6 plus an 8×8 Expert grid – each with a puzzle number you can share.</li>
<li><strong>No guessing needed</strong>: every board is checked by our logic solver, so the answer is unique and reachable step by step.</li>
<li><strong>Daily Tango puzzle</strong> – one 6×6 board for everyone each day, with a streak counter.</li>
<li><strong>Instant rule check</strong>: three-in-a-row, overfull lines and broken signs are highlighted the moment they happen.</li>
<li><strong>Hint that teaches</strong>: it fixes a mistake if you have one, otherwise it fills one forced square and names the row or column that proves it.</li>
<li><strong>Undo, Restart, timer, best times and a Share button</strong> to post your time to friends or colleagues.</li>
<li><strong>Keyboard play</strong>: arrows to move, S or 1 for a sun, M or 2 for a moon, Backspace to clear.</li>
</ul>

<h2>Tango daily archive</h2>
<p>Every daily Tango board we have published stays here, so you can catch up on days you missed. Archive boards count towards your stats; only today's board extends your streak.</p>
{game_archive(datetime.date(2026, 11, 25), "/tango-unlimited/")}

<h2>Tango strategy: six patterns that solve most boards</h2>
<h3>1. Close off every pair</h3>
<p>Whenever two identical symbols sit side by side, the squares at both ends of the pair must be the opposite symbol. Two suns together? Put a moon on each side. This is the single most common move in the game.</p>
<h3>2. Fill the gap</h3>
<p>If two identical symbols have exactly one empty square between them – sun, gap, sun – the gap must be the opposite symbol, otherwise you would get three suns in a row.</p>
<h3>3. Complete a full half</h3>
<p>On a 6×6 board, once a row has three suns, every remaining square in that row is a moon (and the other way round). Count after every move: this rule often finishes a line in one go.</p>
<h3>4. Chain the signs</h3>
<p>Signs pass information along. If A = B and B × C, then A and C are opposite. A run of signs across a row can fix three or four squares as soon as one of them is known.</p>
<h3>5. Two moons left, three gaps</h3>
<p>Near the end of a line, look at which arrangements are still possible. If a row needs two more moons and one sun in three empty squares, and the sun cannot go in the middle without creating a triple, the options shrink fast. Checking the few possible arrangements of one line is exactly how our hint finds its next square.</p>
<h3>6. Switch between rows and columns</h3>
<p>Every square belongs to one row and one column. When a row stops giving you anything, look at the column of the square you just filled – each new symbol is a new clue in the other direction.</p>

<h2>Common Tango mistakes (and how to avoid them)</h2>
<ul>
<li><strong>Reading × as "empty".</strong> The × sign never means "leave blank" – every square gets a symbol. It only says the two squares differ.</li>
<li><strong>Checking only rows.</strong> A row can look perfect while its columns already hold four suns. After each symbol, glance down its column as well as across its row.</li>
<li><strong>Forgetting the gap rule.</strong> Most players spot pairs at once but miss sun–gap–sun. Scan for one-square gaps between equal symbols on every pass.</li>
<li><strong>Guessing on Hard boards.</strong> Every board here can be solved without guessing. If you feel stuck, look for the line with the fewest empty squares and list its possible arrangements – usually only one or two remain.</li>
<li><strong>Racing the clock too early.</strong> Speed comes from recognising patterns, not from tapping faster. Solve Easy and Medium boards cleanly first, then chase times on the daily.</li>
</ul>

<h2>Worked example: one row, one sign</h2>
<p>Imagine a 6×6 row where the first two squares already hold suns, the sixth square holds a moon, and there is an <strong>=</strong> sign between the third and fourth squares. Because of the pair, square 3 must be a moon. The = sign then makes square 4 a moon too. The row now has two suns and three moons, so the last empty square, square 5, must be the third sun – giving sun, sun, moon, moon, sun, moon, with no triple anywhere. A sun, a pair and one sign filled three squares without any guessing – and each of them now gives you a new clue in its column.</p>

<h2>Frequently asked questions</h2>
{faq_html(tfaqs)}
<p class="disclaimer">Unlimited Dailies is an independent website. It is not affiliated with, sponsored by or endorsed by LinkedIn Corporation or Microsoft. "Tango" is used only to describe the puzzle style. All boards on this page are generated by our own code, and the sun and moon symbols are our own drawings.</p>
"""
    page("/tango-unlimited/", "Tango Unlimited – Free Tango Puzzles, No Daily Limit",
         "Play Tango unlimited for free: fill the grid with suns and moons, balance every line and follow the = and × signs. 4 levels, a daily puzzle, smart hints.",
         body, TGAME_JS, [tgame_schema, faq_schema(tfaqs)])

    # ---------- Tango solver ----------
    tsfaqs = [
        ("How do I get the answer to today's Tango puzzle?", "Choose the board size (the daily LinkedIn board is 6×6), tap each square that already shows a sun or moon until it matches, and tap the small circles between squares to add the = and × signs. Press Solve: the solver fills one square at a time and tells you which row or column forces it, or shows the full answer at once."),
        ("How do I enter the = and × signs?", "Between every two neighbouring squares there is a small circle. Tap it once for =, twice for ×, and a third time to remove the sign again."),
        ("Why does the solver say there is no solution?", "One of the symbols or signs was entered differently from your puzzle. Compare row by row – a single wrong sign is enough to make the board impossible."),
        ("Why does it say there is more than one answer?", "Real Tango boards have exactly one solution. If the solver finds two, part of the puzzle is missing – usually a sign or a starting symbol that was not entered."),
        ("Can I just get a hint instead of the whole answer?", "Yes. After Solve, only the first square is shown, together with the reason. Press Show next square for more, one at a time."),
        ("What sizes does the Tango solver support?", "4×4, 6×6, 8×8 and 10×10 boards – every even size used by Tango, Takuzu and binary puzzles with balanced rows and columns."),
        ("Is my board sent anywhere?", "No. The solver runs completely in your browser. Nothing you enter is uploaded or stored on our servers."),
    ]
    body = f"""
<h1>Tango Solver – Today's Tango Answer, Square by Square</h1>
<p class="lead">Stuck on a Tango puzzle? Enter the suns, moons and = / × signs from your board, press Solve, and reveal the answer one square at a time – each with the reason it is forced.</p>
<form id="tsolver" class="card" autocomplete="off">
  <label>Board size:
    <select name="size"><option value="4">4×4</option><option value="6" selected>6×6</option><option value="8">8×8</option><option value="10">10×10</option></select>
  </label>
  <div class="tboard" aria-label="Enter your Tango board"></div>
  <p style="font-size:.9rem;color:var(--muted)">Tap a square for a sun, again for a moon, again to clear. Tap the small circles between squares: once for =, twice for ×.</p>
  <button class="btn primary" type="submit">Solve</button>
  <button class="btn" type="button" data-example>Load example</button>
  <button class="btn" type="button" data-clear>Clear</button>
</form>
<div id="tsolver-out" aria-live="polite"></div>
<div class="ad-slot"></div>

<h2>Stuck on today's Tango? Get the answer in three steps</h2>
<ol>
<li><strong>Pick the size.</strong> The daily Tango board on LinkedIn is 6×6, which is selected already. Use 8×8 or 10×10 for bigger binary puzzles.</li>
<li><strong>Copy the board.</strong> Tap each pre-filled square until it shows the same symbol as your puzzle ({SUN} or {MOON}). Then tap the circle between two squares to add an = or a × sign wherever your puzzle has one.</li>
<li><strong>Press Solve.</strong> The first forced square turns green on the board with a short explanation. Press <em>Show next square</em> for another nudge, or <em>Show full answer</em> to see everything.</li>
</ol>

<h2>How the Tango solver works</h2>
<p>The solver thinks in whole lines, the way experienced players do. For every row and column it lists all the arrangements that are still allowed: the right number of suns and moons, never three in a row, matching every symbol already on the board and every sign inside that line. If one square has the same symbol in all of those arrangements, that symbol is forced – the solver writes it in and remembers which line proved it.</p>
<p>Every new symbol also narrows the crossing column or row, so the solver keeps going round the board until nothing changes. Proper Tango puzzles are finished this way without a single guess. If a board cannot be completed by logic alone, the solver switches to a careful search, and it tells you if it finds no answer or more than one – the most common sign that something was entered wrongly.</p>
<p>Because each step names its row or column, the list of steps doubles as a lesson: look at the line it mentions and try to see why the square is forced before you reveal the next one.</p>

<h2>Solve it yourself next time</h2>
<p>Most boards fall to three habits: put the opposite symbol at both ends of every pair, fill the gap between two equal symbols, and finish any line that already has its full share of one symbol. Practise them on fresh boards in <a href="/tango-unlimited/">Tango Unlimited</a> – every board there is checked to have exactly one solution that can be reached without guessing.</p>

<h2>FAQ</h2>
{faq_html(tsfaqs)}
<p class="disclaimer">Unofficial tool. Not affiliated with LinkedIn. The solver runs entirely in your browser; your board is not sent anywhere.</p>
"""
    page("/tango-solver/", "Tango Solver – Today's Tango Answer, Step by Step",
         "Free Tango solver: enter your suns, moons and = / × signs and get the answer one square at a time, with the reason for each step. 4×4 to 10×10 boards.",
         body, f'<script src="/assets/tango-core.js?v={V}"></script>\n<script src="/assets/tango-solver.js?v={V}"></script>',
         [faq_schema(tsfaqs), {"@context": "https://schema.org", "@type": "WebApplication", "name": "Tango Solver",
          "url": DOMAIN + "/tango-solver/", "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any",
          "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}])

    # ---------- Zip unlimited ----------
    zfaqs = [
        ("What is Zip Unlimited?", "Zip Unlimited is a free practice version of the Zip path puzzle. Draw one line that starts on 1, passes every numbered square in order and fills the whole grid. Every board is made by our own generator, so you can play as many as you like instead of waiting for tomorrow's puzzle."),
        ("Is this the official LinkedIn Zip game?", "No. Unlimited Dailies is an independent site and is not connected to LinkedIn. We only use the general rules of the puzzle style; every board here is generated by our own code and looks different from the official game."),
        ("Does every Zip board have exactly one answer?", "Yes. Before a board is shown, our solver searches for a second path. If one exists, the generator adds a number or a wall and checks again, so every board has exactly one solution."),
        ("Do I have to fill every square?", "Yes. The path must cover every square of the grid exactly once and finish on the highest number. Reaching the last number early is not allowed, which is why the game stops you if you try."),
        ("What are the thick lines between some squares?", "They are walls. Your path cannot cross a wall, so treat it like the edge of the board. Walls appear on Hard, Expert and Daily boards and often force the path into a single direction."),
        ("How do I go back if I took a wrong turn?", "Drag back over your own line to erase it square by square, tap any square of your path to continue from there, or press Undo to remove your last stroke. Restart clears the board."),
        ("What does the Hint button do?", "If your path has gone the wrong way, Hint cuts it back to the last correct square. If everything is right so far, it draws the next few squares of the answer, up to the next number, and highlights where it stopped."),
        ("Can I play Zip with a keyboard?", "Yes. Click the board and press any arrow key to start on 1, then use the arrow keys to extend the path. Moving back onto the previous square erases it, and Backspace removes the last square."),
        ("When does the daily Zip change?", "The daily board changes at midnight UTC and is the same for everyone that day. Solving it on the day adds to your streak, and older dailies stay playable in the archive below."),
        ("Is there a Zip solver?", "Yes. If you are stuck on any Zip board, open our Zip solver, tap in the numbers and walls from your board and reveal the path five squares at a time, or all at once."),
    ]
    zgame_schema = {
        "@context": "https://schema.org", "@type": ["VideoGame", "WebApplication"],
        "name": "Zip Unlimited", "url": DOMAIN + "/zip-unlimited/",
        "description": "Free unlimited Zip-style path puzzles in the browser: draw one line from 1 through every numbered square in order that fills the whole grid. 5×5 to 8×8 boards, walls, hints and a daily puzzle.",
        "applicationCategory": "GameApplication", "operatingSystem": "Any (web browser)",
        "genre": ["Puzzle", "Logic puzzle"], "gamePlatform": "Web browser", "playMode": "SinglePlayer",
        "isAccessibleForFree": True, "inLanguage": "en",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
        "publisher": {"@type": "Organization", "name": SITE, "url": DOMAIN}
    }
    body = f"""
<h1>Zip Unlimited – Play Free Zip Path Puzzles With No Daily Limit</h1>
<p class="lead">Draw one line from 1 to the last number, passing every number in order and filling every square of the grid. Unlimited boards from 5×5 to 8×8, walls, a free daily puzzle and hints – no login, no download.</p>
{ZGAME.format(default="easy")}
<div class="ad-slot"></div>

<h2>How to play Zip</h2>
<ol>
<li><strong>Start on 1.</strong> Press the square with the number 1 and drag your finger or mouse to draw the path. You can also tap neighbouring squares one at a time.</li>
<li><strong>Visit the numbers in order.</strong> Your line must reach 2 before 3, 3 before 4 and so on. The game will not let you enter a number out of turn.</li>
<li><strong>Fill every square.</strong> The path has to pass through every square on the board exactly once. It moves only up, down, left or right – never diagonally – and it can never cross itself.</li>
<li><strong>Respect the walls.</strong> A thick bar between two squares is a wall; your path must go around it.</li>
<li><strong>Finish on the highest number.</strong> When the line covers the whole grid and ends on the last number, the puzzle is solved.</li>
</ol>
<p>Made a wrong turn? Drag back along your line to erase it, or tap any square of the path to continue from there. Stuck on a board from somewhere else – perhaps today's official one? Enter it into the <a href="/zip-solver/">Zip solver</a> and reveal the path a few squares at a time.</p>

<h2>Why practise with unlimited Zip puzzles?</h2>
<p>A daily Zip board is over in a minute, and the fastest players finish in a few seconds. What separates them from everyone else is not quick fingers but a handful of patterns they see instantly: corners that can only be entered one way, narrow corridors that must be walked straight through, and walls that split the board into rooms. Those patterns only become automatic with practice. Here you get a fresh board every time, four sizes to grow into, and a hint that shows you where your path went wrong instead of just finishing the puzzle for you.</p>

<h2>Features</h2>
<ul>
<li><strong>Unlimited boards</strong> at four levels: Easy 5×5, Medium 6×6, Hard 7×7 with walls and Expert 8×8 with walls. Every board has a number you can share or replay.</li>
<li><strong>Exactly one answer</strong>: each board is checked by our solver before you see it.</li>
<li><strong>Daily Zip puzzle</strong> – one 6×6 board for everyone each day, with a streak counter and an archive of earlier dailies.</li>
<li><strong>Smooth drawing</strong> on phones and desktops: drag to draw, drag back to erase, tap any square of your line to continue from it.</li>
<li><strong>Helpful hints</strong> that cut a wrong path back to the last correct square or draw the next stretch up to the next number.</li>
<li><strong>Undo, Restart, timer, best times and a Share button</strong> to compare results with friends or colleagues.</li>
<li><strong>Keyboard play</strong> with the arrow keys and Backspace.</li>
</ul>

<h2>Zip daily archive</h2>
<p>Every daily Zip board we have published stays here, so you can catch up on days you missed. Archive boards count towards your stats; only today's board extends your streak.</p>
{game_archive(datetime.date(2026, 11, 26), "/zip-unlimited/")}

<h2>Zip strategy: patterns that solve most boards</h2>
<h3>1. Corners have only two doors</h3>
<p>A corner square touches just two neighbours. Unless the corner holds 1 or the final number, the path must come in through one of them and leave through the other – so both of those links are fixed before you draw anything. Mark the corners first and the edges of the board often fall into place.</p>
<h3>2. Squares with two exits are fixed</h3>
<p>The same idea works anywhere: if a square has only two open neighbours left – because of walls, the edge of the board or your own line – the path must use both. Walls create these squares all the time, which is why boards with walls are often easier to read than they look.</p>
<h3>3. Never leave a dead end behind</h3>
<p>Before each move, check the squares next to your line. If one of them now has only a single open neighbour, the path can enter it but never leave, so it must be the very last square. If it is not the final number, you have taken a wrong turn – back up straight away.</p>
<h3>4. Do not cut the board in two</h3>
<p>If your line separates a group of empty squares from the rest of the board, you can never come back to finish them. Sweeping along the edge, or filling one region completely before leaving it, keeps every empty square reachable.</p>
<h3>5. Count the distance to the next number</h3>
<p>The squares between two numbers must be filled before you reach the second one. If 4 and 5 are right next to each other but a whole corner of the board is still empty, that corner has to be visited later – on the way from 5 to 6 or further on.</p>
<h3>6. Think in chessboard colours</h3>
<p>Colour the grid like a chessboard. Every step changes colour, so on a board with an odd number of squares the path must start and end on the more common colour. This quick check tells you which of two routes can possibly be right without drawing either of them.</p>

<h2>Common Zip mistakes</h2>
<ul>
<li><strong>Racing to the next number.</strong> The shortest way from 3 to 4 is rarely the right one; the empty squares around it still need to be filled later.</li>
<li><strong>Ignoring walls.</strong> A wall is not just an obstacle – it reduces the exits of the squares beside it, and those squares are often forced.</li>
<li><strong>Leaving single gaps.</strong> One empty square trapped between your line and the edge is almost always a dead end.</li>
<li><strong>Starting over too quickly.</strong> Drag back to the point where things went wrong instead of restarting; most of your path is usually right.</li>
</ul>

<h2>Worked example: a corner that solves itself</h2>
<p>Picture the top-left corner of a board where 1 sits two squares to the right of the corner and no number is in the corner itself. The corner square can only be reached from the square below it or the square to its right, so the path must use both links: below-corner → corner → right-of-corner. That right-hand neighbour sits directly next to 1. Unless the path is to end in this corner, the line from 1 has to start by turning left into it, run through the corner and continue straight down the left edge. Three squares are fixed before you draw a single line – and the next corner usually works the same way.</p>

<h2>Frequently asked questions</h2>
{faq_html(zfaqs)}
<p class="disclaimer">Unlimited Dailies is an independent website. It is not affiliated with, sponsored by or endorsed by LinkedIn Corporation or Microsoft. "Zip" is used only to describe the puzzle style. All boards on this page are generated by our own code.</p>
"""
    page("/zip-unlimited/", "Zip Unlimited – Free Zip Path Puzzles, No Daily Limit",
         "Play Zip unlimited free: draw one path from 1 through every number in order and fill the whole grid. 5×5 to 8×8 boards, walls, hints and a daily puzzle.",
         body, ZGAME_JS, [zgame_schema, faq_schema(zfaqs)])

    # ---------- Zip solver ----------
    zsfaqs = [
        ("How do I get the answer to today's Zip puzzle?", "Pick the board size, tap the squares in the order of their numbers (the first tap places 1, the next 2 and so on), switch to Walls and tap between squares to add any walls, then press Solve. The path appears five squares at a time, or all at once if you choose."),
        ("I placed a number in the wrong square. How do I fix it?", "Tap the number again to remove it. The next tap on an empty square places the lowest missing number, so you can put it back in the right place."),
        ("How do I add walls?", "Press the Walls button. Small dots appear between the squares; tap a dot to add a wall there and tap it again to remove it. Press Numbers to go back to placing numbers."),
        ("Why does the solver say there is no path?", "A number is in the wrong square, a number is missing, or a wall was added where the puzzle has none. Compare your board with the original square by square."),
        ("Why does it say there is more than one answer?", "Proper Zip boards have exactly one path. If the solver finds two, something from the puzzle – usually a wall or a number – has not been entered yet. It still shows one valid path."),
        ("What sizes does the Zip solver support?", "Any square board from 4×4 to 9×9. Most daily Zip boards are 6×6, 7×7 or 8×8."),
        ("Is my board sent anywhere?", "No. The solver runs entirely in your browser, in the background so the page never freezes. Nothing you enter is uploaded or stored."),
    ]
    body = f"""
<h1>Zip Solver – Today's Zip Answer, a Few Squares at a Time</h1>
<p class="lead">Stuck on a Zip puzzle? Tap in the numbers and walls from your board, press Solve and reveal the path five squares at a time – or the whole answer at once.</p>
<form id="zsolver" class="card" autocomplete="off">
  <label>Board size:
    <select name="size"><option value="4">4×4</option><option value="5">5×5</option><option value="6" selected>6×6</option><option value="7">7×7</option><option value="8">8×8</option><option value="9">9×9</option></select>
  </label>
  <div class="modebar" role="group" aria-label="What to enter"><button type="button" data-mode="num" aria-pressed="true">Numbers</button><button type="button" data-mode="wall" aria-pressed="false">Walls</button></div>
  <div class="zboard" aria-label="Enter your Zip board"></div>
  <p style="font-size:.9rem;color:var(--muted)">Numbers: tap squares in order – 1, then 2, then 3… Tap a number again to remove it. Walls: tap the dot between two squares.</p>
  <button class="btn primary" type="submit">Solve</button>
  <button class="btn" type="button" data-example>Load example</button>
  <button class="btn" type="button" data-clear>Clear</button>
</form>
<div id="zsolver-out" aria-live="polite"></div>
<div class="ad-slot"></div>

<h2>Stuck on today's Zip? Get the answer in three steps</h2>
<ol>
<li><strong>Pick the size.</strong> Count the squares in one row of your puzzle and choose the matching size – 6×6 is selected already.</li>
<li><strong>Copy the board.</strong> Tap the square with 1, then the square with 2, and so on until every number is in place. If your board has walls, press <em>Walls</em> and tap the dot between the two squares each wall separates.</li>
<li><strong>Press Solve.</strong> The first five squares of the path are drawn on your board. Press <em>Show next 5 squares</em> for another nudge, or <em>Show full answer</em> to see the complete path.</li>
</ol>

<h2>How the Zip solver works</h2>
<p>The solver walks the path forward from 1, one square at a time, and tries each possible direction. After every step it checks three things that let it throw away hopeless routes early. First, every empty square still needs two open neighbours – one to come in and one to leave – except the final square, which needs only one. Second, the empty squares must all still be connected to the head of the path; if a group gets cut off, the route is abandoned. Third, it uses the chessboard rule: each step changes colour, so the number of empty light and dark squares has to match what the remaining path can cover.</p>
<p>With those checks, a typical 6×6 to 8×8 board is solved in a fraction of a second. The solver then keeps searching for a second answer. If it finds one, it tells you, because a real Zip board has exactly one path and a second answer means part of the board is missing.</p>

<h2>Solve it yourself next time</h2>
<p>Three habits crack most Zip boards: fix the corners first, because a corner square can only be entered and left one way; never leave an empty square with just one open neighbour; and never cut a group of empty squares off from the rest of the board. Practise them on fresh boards in <a href="/zip-unlimited/">Zip Unlimited</a> – every board there has exactly one solution, and the hint shows you exactly where a path went wrong.</p>

<h2>FAQ</h2>
{faq_html(zsfaqs)}
<p class="disclaimer">Unofficial tool. Not affiliated with LinkedIn. The solver runs entirely in your browser; your board is not sent anywhere.</p>
"""
    page("/zip-solver/", "Zip Solver – Today's Zip Answer, Step by Step",
         "Free Zip solver: tap in the numbers and walls from your board and reveal the path five squares at a time or all at once. Works for any 4×4 to 9×9 board.",
         body, f'<script src="/assets/zip-core.js?v={V}"></script>\n<script src="/assets/zip-solver.js?v={V}"></script>',
         [faq_schema(zsfaqs), {"@context": "https://schema.org", "@type": "WebApplication", "name": "Zip Solver",
          "url": DOMAIN + "/zip-solver/", "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any",
          "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}])

    # ---------- Home ----------
    launch = datetime.date(2026, 11, 21)
    today_n = (datetime.date.today() - launch).days + 1
    archive_html = "".join(
        f'<li><a href="{"/" if n == today_n else "/?daily=%d" % n}">#{n} · {(launch + datetime.timedelta(days=n - 1)).isoformat()}{" (today)" if n == today_n else ""}</a></li>'
        for n in range(today_n, 0, -1))
    dfaqs = [
        ("When does the daily puzzle change?", "A new daily puzzle appears every day at midnight UTC. Everyone who visits on the same day gets the same 4×4 board with one wildcard tile, so you can compare times with friends."),
        ("Is this the same puzzle as the official LinkedIn Sumbreak?", "No. Our daily board is created by our own generator, so it is a different puzzle from the one on LinkedIn. It is a free extra puzzle to warm up with or to play after you have finished the official one."),
        ("Can I play yesterday's daily puzzle?", "Yes. Use the daily puzzle archive above: every past daily is listed by number and date, and you can replay any of them as often as you like."),
        ("How does the daily streak work?", "Solve today's puzzle to add one day to your streak. Miss a day and the streak starts again from one. Your streak is stored only in this browser, so it does not follow you to another device."),
    ]
    body = f"""
<h1>Unlimited Dailies – Play Your Favourite Daily Puzzles Without Limits</h1>
<p class="lead">Love daily puzzle games but hate waiting until tomorrow? Play free, unlimited practice versions in your browser – no login, no download.</p>
<div class="grid-links">
  <a class="card" href="/sumbreak-unlimited/"><strong>Sumbreak Unlimited <span class="tag">New</span></strong><small>Merge numbers until one tile is left. 3×3 to 6×6 boards, wildcards & a daily puzzle.</small></a>
  <a class="card" href="/sumbreak-solver/"><strong>Sumbreak Solver</strong><small>Stuck on today's board? Enter it (wildcards too) and get the answer one hint at a time.</small></a>
  <a class="card" href="/queens-unlimited/"><strong>Queens Unlimited <span class="tag">New</span></strong><small>One queen per row, column and colour. 6×6 to 10×10 boards & a daily puzzle.</small></a>
  <a class="card" href="/queens-solver/"><strong>Queens Solver</strong><small>Paint your board's regions and reveal the answer one queen at a time.</small></a>
  <a class="card" href="/tango-unlimited/"><strong>Tango Unlimited <span class="tag">New</span></strong><small>Fill the grid with suns and moons: equal counts, never three in a row, follow the = and × signs.</small></a>
  <a class="card" href="/tango-solver/"><strong>Tango Solver</strong><small>Enter your suns, moons and signs and get the answer square by square, with the reason.</small></a>
  <a class="card" href="/zip-unlimited/"><strong>Zip Unlimited <span class="tag">New</span></strong><small>Draw one path from 1 through every number in order and fill every square. 5×5 to 8×8 & a daily.</small></a>
  <a class="card" href="/zip-solver/"><strong>Zip Solver</strong><small>Tap in your numbers and walls and reveal the path five squares at a time.</small></a>
  <a class="card" href="/how-to-play-sumbreak/"><strong>How to Play Sumbreak</strong><small>Rules, dead spots and strategy tips.</small></a>
</div>
<h2>Today's free puzzle</h2>
{GAME.format(default="daily")}
<div class="ad-slot"></div>
<h2>What is Unlimited Dailies?</h2>
<p>Daily puzzle games are a great five-minute habit, but one puzzle a day is rarely enough – especially when you are learning a new game. Unlimited Dailies builds free practice versions of popular daily puzzle styles, with our own puzzle generator, so you can play as many rounds as you want and get better before tomorrow's official puzzle.</p>
<ul>
<li><strong>Unlimited rounds</strong> at different difficulty levels.</li>
<li><strong>Always solvable</strong> puzzles, with hints and undo.</li>
<li><strong>Fast and private</strong> – everything runs in your browser.</li>
</ul>
<p>Right now you can play <a href="/sumbreak-unlimited/">Sumbreak Unlimited</a>, the newest daily number-merge puzzle, <a href="/queens-unlimited/">Queens Unlimited</a>, the colour-region logic puzzle with one queen per row, column and region, <a href="/tango-unlimited/">Tango Unlimited</a>, the sun-and-moon balance grid, and <a href="/zip-unlimited/">Zip Unlimited</a>, the one-line path puzzle – each with its own step-by-step solver. More puzzle styles are on the way.</p>
<h2 id="archive">Daily puzzle archive</h2>
<p>Missed a day? Every daily puzzle we have published stays here. Pick a number to replay it – the ones you have solved on this device are ticked. Only today's puzzle counts towards your streak.</p>
<ul class="archive" data-archive>{archive_html}</ul>
<h2>The Sumbreak game in a nutshell</h2>
<p>Sumbreak is a number-merge logic puzzle: drag a number onto an identical neighbour and the two tiles become their sum, leaving an empty square behind. Keep merging until only one tile is left. Tiles never slide, so every merge is a decision – merge in the wrong direction and a number can end up with no partner at all. Newer boards add wildcard tiles (×2 and +N) that can merge with any number.</p>
<p>The daily puzzle above is the same for everyone today and changes at midnight UTC. For more, play <a href="/sumbreak-unlimited/">unlimited Sumbreak boards</a> from an easy 3×3 to a 6×6 expert grid, learn the patterns in our <a href="/how-to-play-sumbreak/">rules and strategy guide</a>, or check a tricky position with the <a href="/sumbreak-solver/">step-by-step solver</a>.</p>
<h2>Daily puzzle FAQ</h2>
{faq_html(dfaqs)}
<p class="disclaimer">Unlimited Dailies is independent and not affiliated with LinkedIn, Microsoft, The New York Times or any other puzzle publisher.</p>
"""
    page("/", "Play Sumbreak Game Free – Daily Puzzles | Unlimited Dailies",
         "Play the Sumbreak game free: a new daily puzzle, an archive of past dailies, unlimited boards, a step-by-step solver and strategy guides. No login needed.",
         body, GAME_JS, [faq_schema(dfaqs), {"@context": "https://schema.org", "@type": "WebSite", "name": SITE, "url": DOMAIN + "/"},
                         {"@context": "https://schema.org", "@type": "Organization", "name": SITE, "url": DOMAIN + "/", "logo": DOMAIN + "/favicon.svg", "email": EMAIL}])

    # ---------- About / Contact / Privacy / Terms ----------
    page("/about/", "About Unlimited Dailies", "About Unlimited Dailies: free unlimited practice versions of popular daily puzzle games.", f"""
<h1>About Unlimited Dailies</h1>
<p>Unlimited Dailies is a small independent website that makes free, unlimited practice versions of popular daily puzzle styles. Our games are <a href="/sumbreak-unlimited/">Sumbreak Unlimited</a>, a number-merge logic puzzle with a <a href="/sumbreak-solver/">solver</a> and a <a href="/how-to-play-sumbreak/">strategy guide</a>, <a href="/queens-unlimited/">Queens Unlimited</a>, a colour-region queen-placement puzzle with its own <a href="/queens-solver/">Queens solver</a>, <a href="/tango-unlimited/">Tango Unlimited</a>, a sun-and-moon binary grid with a <a href="/tango-solver/">Tango solver</a>, and <a href="/zip-unlimited/">Zip Unlimited</a>, a numbered path puzzle with a <a href="/zip-solver/">Zip solver</a>.</p>
<p>All puzzles are created by our own generator, and every board is checked to be solvable. The site is free to use and is supported by advertising.</p>
<p>We are not affiliated with LinkedIn, Microsoft, The New York Times or any other game publisher. Game names are used only to describe the style of puzzle.</p>
<p>Questions or ideas for the next game? <a href="/contact/">Contact us</a>.</p>
""")
    page("/contact/", "Contact – Unlimited Dailies", "Contact Unlimited Dailies with feedback, bug reports or game suggestions.", f"""
<h1>Contact us</h1>
<p>Found a bug, have a puzzle idea, or want to suggest the next game to add? We read every message.</p>
<p>Email: <a href="mailto:{EMAIL}">{EMAIL}</a></p>
<p>Please include your device and browser if you are reporting a problem with a puzzle.</p>
""")
    page("/privacy-policy/", "Privacy Policy – Unlimited Dailies", "Privacy policy for Unlimited Dailies.", f"""
<h1>Privacy Policy</h1>
<p>Last updated: {TODAY}</p>
<h2>What we store</h2>
<p>Unlimited Dailies does not require an account. Your game progress, best times and streaks are stored only in your own browser (local storage) and are never sent to us. Numbers you type into the solver are processed in your browser and are not uploaded.</p>
<h2>Analytics and hosting</h2>
<p>The site is hosted by Cloudflare, which may process technical data such as IP addresses to deliver and protect the site. We use Google Analytics to understand how visitors use the site (for example which pages are visited and roughly from which country). Google Analytics uses cookies and similar technologies; you can learn more in <a href="https://policies.google.com/technologies/partner-sites" rel="nofollow">How Google uses information from sites that use its services</a> and opt out with the <a href="https://tools.google.com/dlpage/gaoptout" rel="nofollow">Google Analytics opt-out add-on</a>.</p>
<h2>Advertising and cookies</h2>
<p>This site may show ads from third-party advertising partners, such as Google AdSense or Monetag. These partners may use cookies or similar technologies to show ads based on your visits to this and other websites. Google's use of advertising cookies enables it and its partners to serve ads based on your visits to this and other sites. You can opt out of personalised advertising at <a href="https://adssettings.google.com" rel="nofollow">Google Ads Settings</a> or <a href="https://www.aboutads.info" rel="nofollow">aboutads.info</a>.</p>
<h2>Children</h2>
<p>The site is intended for a general audience and does not knowingly collect personal information from children.</p>
<h2>Contact</h2>
<p>Questions about this policy: <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
""")
    page("/terms/", "Terms of Use – Unlimited Dailies", "Terms of use for Unlimited Dailies.", f"""
<h1>Terms of Use</h1>
<p>Last updated: {TODAY}</p>
<p>Unlimited Dailies provides free puzzle games and tools "as is", without warranties of any kind. You may use the site for personal, non-commercial entertainment.</p>
<p>All puzzles are generated by our own code. Game names such as "Sumbreak", "Queens", "Tango" and "Zip" are trademarks of their respective owners and are used here only to describe a puzzle style. Unlimited Dailies is not affiliated with or endorsed by those owners.</p>
<p>We may change or remove games at any time. Questions: <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
""")

    # ---------- 404, robots, sitemap ----------
    html404 = head("Page not found – Unlimited Dailies", "Page not found.", "/404", noindex=True) + """
<h1>Page not found</h1>
<p>That page doesn't exist. Try <a href="/sumbreak-unlimited/">Sumbreak Unlimited</a> or go to the <a href="/">home page</a>.</p>
""" + FOOT + "</body></html>"
    open(os.path.join(OUT, "404.html"), "w").write(html404)
    open(os.path.join(OUT, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\n\nSitemap: {DOMAIN}/sitemap.xml\n")
    urls = [("/", "1.0"), ("/sumbreak-unlimited/", "1.0"), ("/sumbreak-solver/", "0.9"), ("/how-to-play-sumbreak/", "0.8"),
            ("/queens-unlimited/", "1.0"), ("/queens-solver/", "0.9"),
            ("/tango-unlimited/", "1.0"), ("/tango-solver/", "0.9"),
            ("/zip-unlimited/", "1.0"), ("/zip-solver/", "0.9"),
            ("/about/", "0.3"), ("/contact/", "0.3"), ("/privacy-policy/", "0.2"), ("/terms/", "0.2")]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    sm += "".join(f"  <url><loc>{DOMAIN}{u}</loc><lastmod>{TODAY}</lastmod><priority>{p}</priority></url>\n" for u, p in urls)
    sm += "</urlset>\n"
    open(os.path.join(OUT, "sitemap.xml"), "w").write(sm)
    print("built", OUT)

if __name__ == "__main__":
    build()
