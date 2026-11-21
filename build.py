#!/usr/bin/env python3
"""Builds the static pages of unlimiteddailies.com into ./site (deploy that folder)."""
import json, os, shutil, datetime

DOMAIN = "https://unlimiteddailies.com"
SITE = "Unlimited Dailies"
EMAIL = "contact@unlimiteddailies.com"
TODAY = datetime.date.today().isoformat()
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")
V = "1"  # bump to bust asset cache

NAV = [("/sumbreak-unlimited/", "Sumbreak Unlimited"), ("/sumbreak-solver/", "Solver"), ("/how-to-play-sumbreak/", "How to play")]

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
<p><a href="/">Home</a><a href="/sumbreak-unlimited/">Sumbreak Unlimited</a><a href="/sumbreak-solver/">Sumbreak Solver</a><a href="/how-to-play-sumbreak/">How to Play</a><a href="/about/">About</a><a href="/contact/">Contact</a><a href="/privacy-policy/">Privacy</a><a href="/terms/">Terms</a></p>
<p>© {datetime.date.today().year} {SITE}. Free, unofficial practice puzzles. Not affiliated with, endorsed by or connected to LinkedIn Corporation or Microsoft. "Sumbreak" is used only to describe the puzzle style.</p>
</div></footer>
"""

def page(path, title, desc, body, scripts="", schema=None, noindex=False):
    html = head(title, desc, path, schema, noindex) + body + FOOT + scripts + "\n</body>\n</html>\n"
    d = os.path.join(OUT, path.strip("/"))
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "index.html"), "w") as f:
        f.write(html)

def faq_schema(faqs):
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]}

def faq_html(faqs):
    return '<div class="faq">' + "".join(f"<details><summary>{q}</summary><p>{a}</p></details>" for q, a in faqs) + "</div>"

GAME = """
<div id="game" data-default="{default}">
  <div class="levels" role="group" aria-label="Choose difficulty">
    <button type="button" data-level-btn="daily">Daily</button>
    <button type="button" data-level-btn="easy">Easy</button>
    <button type="button" data-level-btn="medium">Medium</button>
    <button type="button" data-level-btn="hard">Hard</button>
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
    <button type="button" class="btn primary" data-next>Next puzzle</button>
    <button type="button" class="btn" data-share>Share result</button>
    <button type="button" class="btn" data-close>Close</button>
  </div>
</div>
"""
GAME_JS = f'<script src="/assets/core.js?v={V}"></script>\n<script src="/assets/game.js?v={V}"></script>'

def build():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    shutil.copytree(os.path.join(os.path.dirname(OUT), "assets"), os.path.join(OUT, "assets"))
    for f in ["favicon.svg", "og.png", "_headers", "_redirects"]:
        src = os.path.join(os.path.dirname(OUT), "static", f)
        if os.path.exists(src):
            shutil.copy(src, OUT)

    # ---------- Sumbreak Unlimited (main page) ----------
    faqs = [
        ("What is Sumbreak Unlimited?", "Sumbreak Unlimited is a free, unofficial practice version of the Sumbreak-style number puzzle. Instead of one puzzle a day, you can play as many boards as you like in Easy, Medium and Hard, plus a free daily puzzle of our own."),
        ("Is this the official LinkedIn Sumbreak game?", "No. The official game is played on LinkedIn. This site is an independent fan-made practice tool that uses the same simple idea (merging identical neighbouring numbers) and creates its own puzzles. We are not affiliated with LinkedIn."),
        ("How do you play Sumbreak?", "Drag a number onto an identical number right next to it (up, down, left or right). The two tiles combine into their sum, and the tile you moved leaves an empty dead spot. Keep merging until only one number is left on the board."),
        ("Can I play Sumbreak more than once a day?", "The official game gives one puzzle per day. Here you can play unlimited puzzles: every time you press New puzzle you get a fresh, solvable board."),
        ("Is every puzzle solvable?", "Yes. Every board is built backwards from a single finished tile, so there is always at least one correct order of merges. If you get stuck, use Undo or the Hint button."),
        ("Do I need an account or download?", "No. The game runs in your browser on phone, tablet or computer. There is no sign-up, and your stats are saved only on your own device."),
        ("What is the difference between Easy, Medium and Hard?", "Easy uses a 3×3 board like the early official puzzles, Medium uses 4×4, and Hard uses a 5×5 board with 25 tiles and many more possible wrong turns."),
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
<p class="lead">Merge identical neighbouring numbers until only one tile is left. Unlimited Easy, Medium and Hard boards, a free daily puzzle, hints and undo – no login needed.</p>
{GAME.format(default="easy")}
<div class="ad-slot"></div>

<h2>How to play Sumbreak Unlimited</h2>
<ol>
<li><strong>Find a pair.</strong> Look for two identical numbers that touch side by side or above and below each other. Diagonal tiles do not count.</li>
<li><strong>Merge them.</strong> Drag one number onto the other (or tap one, then tap the other). They combine into their sum: 4 + 4 becomes 8.</li>
<li><strong>Watch the dead spot.</strong> The tile you moved leaves an empty space behind. Empty spaces can never be filled again, so they can cut the board into pieces.</li>
<li><strong>Finish with one tile.</strong> The puzzle is solved when a single number remains. Every board here is guaranteed to have a solution.</li>
</ol>
<p>New to the puzzle? Read our full <a href="/how-to-play-sumbreak/">Sumbreak rules and strategy guide</a>. Stuck on today's official board? Type it into the <a href="/sumbreak-solver/">Sumbreak solver</a> to get the answer step by step.</p>

<h2>Why play unlimited Sumbreak puzzles?</h2>
<p>The daily version is over in a minute or two, and then you have to wait until midnight Pacific Time for the next one. Practising here helps you spot the patterns that matter – which small numbers to clear first, which merges leave a tile stranded, and when to merge <em>towards</em> the big numbers instead of away from them. Players who practise a few boards usually solve the daily puzzle faster and with fewer mistakes.</p>

<h2>Features</h2>
<ul>
<li><strong>Unlimited puzzles</strong> in three difficulty levels, each with its own puzzle number you can share.</li>
<li><strong>Daily puzzle</strong> – one shared board for everyone each day, with a streak counter.</li>
<li><strong>Hint, Undo and Restart</strong> so you can learn instead of guessing.</li>
<li><strong>Timer and best times</strong> saved on your device.</li>
<li><strong>Works everywhere</strong> – drag on touch screens, click or use the keyboard on desktop.</li>
</ul>

<h2>Quick tips</h2>
<ul>
<li>Clear the <strong>smallest numbers first</strong>. A 1 or 2 that ends up alone can never be merged, because no new small numbers are ever created.</li>
<li>Count each value: an <strong>odd number of the smallest tile</strong> on the board means something has already gone wrong.</li>
<li>Before each merge, check that you are not <strong>cutting the board in two</strong> with a new dead spot.</li>
<li>Merge so the result lands <strong>next to a matching number</strong>, keeping chains going.</li>
</ul>

<h2>Frequently asked questions</h2>
{faq_html(faqs)}
<p class="disclaimer">Unlimited Dailies is an independent website. It is not affiliated with, sponsored by or endorsed by LinkedIn Corporation or Microsoft. All puzzles on this page are generated by our own code.</p>
"""
    page("/sumbreak-unlimited/", "Sumbreak Unlimited – Play Free Sumbreak Puzzles (No Daily Limit)",
         "Play Sumbreak unlimited for free: merge identical numbers until one tile is left. Easy, Medium & Hard boards, daily puzzle, hints and undo. No login.",
         body, GAME_JS, [game_schema, faq_schema(faqs)])

    # ---------- Solver ----------
    sfaqs = [
        ("How do I get today's Sumbreak answer?", "Open today's puzzle on LinkedIn, choose the matching board size here, type each number into the same position (leave dead spots blank) and press Solve. You will get the full list of merges in order."),
        ("Why does the solver say there is no solution?", "Usually one number was typed in the wrong cell. Also check the total: in a solvable board all the numbers add up to a power of two such as 64, 128, 256 or 512."),
        ("Does the solver work for unlimited puzzles too?", "Yes. It works for any board that follows the merge rules: identical numbers that touch up, down, left or right combine into their sum."),
        ("Is using the solver cheating?", "That is up to you. Many players only reveal the first step or two, then finish the puzzle themselves. If you want practice instead, play our unlimited boards."),
    ]
    body = f"""
<h1>Sumbreak Solver – Today's Sumbreak Answer, Step by Step</h1>
<p class="lead">Stuck on the daily Sumbreak puzzle? Type the board below and get every merge in the right order.</p>
<form id="solver" class="card" autocomplete="off">
  <label>Board size:
    <select name="size"><option>3x3</option><option>3x4</option><option>4x3</option><option>4x4</option><option>4x5</option><option>5x4</option><option>5x5</option></select>
  </label>
  <div class="solver-grid"></div>
  <p style="font-size:.9rem;color:var(--muted)">Leave empty / dead spots blank. Rows go top to bottom, columns left to right.</p>
  <button class="btn primary" type="submit">Solve</button>
  <button class="btn" type="button" data-example>Load example (puzzle #1)</button>
  <button class="btn" type="button" data-clear>Clear</button>
</form>
<div id="solver-out" aria-live="polite"></div>
<div class="ad-slot"></div>

<h2>How the Sumbreak solver works</h2>
<p>The solver tries merges the same way you would, but much faster. It starts with the smallest numbers, because those are the tiles most likely to get stranded, and skips any position that cannot be finished – for example when a dead spot splits the board in two, or when an odd number of the smallest tile is left. As soon as it finds an order of merges that ends in one tile, it shows you the full path.</p>
<h2>Example: Sumbreak puzzle #1</h2>
<p>The first puzzle was a 3×3 board: <code>1 1 64 / 4 2 32 / 4 4 16</code>. Its numbers add up to 128, and it takes eight merges. Press <em>Load example</em> above and then <em>Solve</em> to see one correct order.</p>
<h2>Want to get better instead?</h2>
<p>Practise with unlimited boards in <a href="/sumbreak-unlimited/">Sumbreak Unlimited</a>, or read the <a href="/how-to-play-sumbreak/">strategy guide</a> to learn the patterns the solver uses.</p>
<h2>FAQ</h2>
{faq_html(sfaqs)}
<p class="disclaimer">Unofficial tool. Not affiliated with LinkedIn. The solver runs entirely in your browser; the numbers you type are not sent anywhere.</p>
"""
    page("/sumbreak-solver/", "Sumbreak Solver – Today's Sumbreak Answer & Hints (Step by Step)",
         "Free Sumbreak solver: type today's board and get the answer as a list of merges. Works for 3x3 to 5x5 boards. Also play unlimited Sumbreak puzzles.",
         body, f'<script src="/assets/core.js?v={V}"></script>\n<script src="/assets/solver.js?v={V}"></script>',
         [faq_schema(sfaqs), {"@context": "https://schema.org", "@type": "WebApplication", "name": "Sumbreak Solver",
          "url": DOMAIN + "/sumbreak-solver/", "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any",
          "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}])

    # ---------- How to play ----------
    hfaqs = [
        ("Can tiles merge diagonally in Sumbreak?", "No. Only tiles that share a side – up, down, left or right – can be merged."),
        ("Can you merge two different numbers?", "No. Only identical numbers combine. A 4 can merge with a 4 to make 8, but never with a 2 or an 8."),
        ("What happens to the tile you drag?", "It disappears and leaves an empty dead spot. The sum appears where you dropped it."),
        ("What is the final number in Sumbreak?", "It is the total of all numbers on the starting board, which is always a power of two (for example 128 in the first puzzle)."),
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
<li>You may merge two tiles only if they show the <strong>same number</strong>.</li>
<li>The two tiles must be <strong>orthogonal neighbours</strong> – sharing a side, not just a corner.</li>
<li>Drag one tile onto the other. The target becomes the <strong>sum</strong>; the tile you dragged becomes an <strong>empty dead spot</strong>.</li>
<li>Dead spots stay empty for the rest of the puzzle. Tiles never slide or fall.</li>
<li>The puzzle is solved when exactly <strong>one tile</strong> remains.</li>
</ol>

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
<p>Add up all the numbers on the board. The final tile will be that total, and it is always a power of two. This also helps you check that you copied a board correctly into the <a href="/sumbreak-solver/">solver</a>.</p>

<h2>Worked example</h2>
<p>Take the board <code>1 1 64 / 4 2 32 / 4 4 16</code> (total 128). First merge the two 1s into a 2 – it now sits next to the other 2. Merge those into a 4, then pair up the 4s into 8s and 16s, building up to 32 and 64 until a single 128 remains. Try it yourself in the <a href="/sumbreak-solver/">solver</a> using <em>Load example</em>.</p>

<h2>FAQ</h2>
{faq_html(hfaqs)}
<p class="disclaimer">This guide is written by Unlimited Dailies and is not affiliated with LinkedIn. Rules are described as they appear in the public game.</p>
"""
    page("/how-to-play-sumbreak/", "How to Play Sumbreak – Rules, Tips & Strategy Guide",
         "Learn how to play Sumbreak, LinkedIn's daily number-merge puzzle: rules, dead spots, and 6 strategy tips to stop getting stuck. Then practise with unlimited puzzles.",
         body, "", [faq_schema(hfaqs), {"@context": "https://schema.org", "@type": "Article",
          "headline": "How to Play Sumbreak – Rules, Tips & Strategy Guide", "datePublished": TODAY, "dateModified": TODAY,
          "author": {"@type": "Organization", "name": SITE}, "publisher": {"@type": "Organization", "name": SITE},
          "mainEntityOfPage": DOMAIN + "/how-to-play-sumbreak/"}])

    # ---------- Home ----------
    body = f"""
<h1>Unlimited Dailies – Play Your Favourite Daily Puzzles Without Limits</h1>
<p class="lead">Love daily puzzle games but hate waiting until tomorrow? Play free, unlimited practice versions in your browser – no login, no download.</p>
<div class="grid-links">
  <a class="card" href="/sumbreak-unlimited/"><strong>Sumbreak Unlimited <span class="tag">New</span></strong><small>Merge identical numbers until one tile is left. Easy, Medium, Hard & daily.</small></a>
  <a class="card" href="/sumbreak-solver/"><strong>Sumbreak Solver</strong><small>Stuck on today's board? Get the answer step by step.</small></a>
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
<p>We are starting with Sumbreak, the newest daily number puzzle, and will add more puzzle styles soon.</p>
<p class="disclaimer">Unlimited Dailies is independent and not affiliated with LinkedIn, Microsoft, The New York Times or any other puzzle publisher.</p>
"""
    page("/", "Unlimited Dailies – Free Unlimited Daily Puzzle Games (Sumbreak & more)",
         "Play daily puzzle games without the daily limit. Free unlimited Sumbreak puzzles, a Sumbreak solver and strategy guides. No login, works on any device.",
         body, GAME_JS, [{"@context": "https://schema.org", "@type": "WebSite", "name": SITE, "url": DOMAIN + "/"},
                         {"@context": "https://schema.org", "@type": "Organization", "name": SITE, "url": DOMAIN + "/", "logo": DOMAIN + "/favicon.svg", "email": EMAIL}])

    # ---------- About / Contact / Privacy / Terms ----------
    page("/about/", "About Unlimited Dailies", "About Unlimited Dailies: free unlimited practice versions of popular daily puzzle games.", f"""
<h1>About Unlimited Dailies</h1>
<p>Unlimited Dailies is a small independent website that makes free, unlimited practice versions of popular daily puzzle styles. Our first game is <a href="/sumbreak-unlimited/">Sumbreak Unlimited</a>, a number-merge logic puzzle, together with a <a href="/sumbreak-solver/">solver</a> and a <a href="/how-to-play-sumbreak/">strategy guide</a>.</p>
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
<p>The site is hosted by Cloudflare, which may process technical data such as IP addresses to deliver and protect the site. We may use privacy-friendly analytics to count page views.</p>
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
<p>All puzzles are generated by our own code. Game names such as "Sumbreak" are trademarks of their respective owners and are used here only to describe a puzzle style. Unlimited Dailies is not affiliated with or endorsed by those owners.</p>
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
            ("/about/", "0.3"), ("/contact/", "0.3"), ("/privacy-policy/", "0.2"), ("/terms/", "0.2")]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    sm += "".join(f"  <url><loc>{DOMAIN}{u}</loc><lastmod>{TODAY}</lastmod><priority>{p}</priority></url>\n" for u, p in urls)
    sm += "</urlset>\n"
    open(os.path.join(OUT, "sitemap.xml"), "w").write(sm)
    print("built", OUT)

if __name__ == "__main__":
    build()
