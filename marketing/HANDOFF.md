# Ad campaign — where things stand

Last worked on 2026-09-22. Everything in `marketing/` is **untracked** — nothing here
is committed or deployed. Decide whether to commit it; the site does not need it.

## What this is

A 15-second silent video ad for Facebook/Instagram, built in the site's own visual
language (the handheld-console shell from `css/main.css` — cream screen, orange shell,
scanlines, pixel type, the Mana Seed mascot, the 16px icons).

Not a screen recording of the site: it's a canvas animation that reuses the same
palette, type and furniture, laid out for a phone.

## Files

| Path | What it is |
|---|---|
| `marketing/src/` | **The real source.** Edit these. |
| `marketing/build.ps1` | Concatenates `src/` → `ad.html`. Verified byte-identical. |
| `marketing/ad.html` | Built artifact — self-contained, ~85KB, runs from `file://`. Also a previewer (play/scrub/jump-to-scene/cut switch/aspect switch/PNG export). |
| `marketing/render.ps1` | Headless-Chrome-over-CDP frame renderer → ffmpeg → MP4. |
| `marketing/out/*.mp4` | The eight finished files: two cuts x four aspects. |
| `marketing/ad-copy.md` | Primary texts, headlines, descriptions, the destination URL and its UTMs. Drafted, still not chosen. |

**Do not hand-edit `ad.html`** — `build.ps1` overwrites it.

### src/ layout

- `part0.html` — `<head>`, previewer UI, opening `<script>`
- `art.js` — `ART`: every sprite as a base64 data URI (icons, mascot strip, portrait, instrument strips)
- `engine1.js` — palette `C`, `FORMATS`, `CUTS` + `setCut()`, `isWide()`, text-fitting helpers
- `engine2.js` — the console shell (`drawShell`) + `drawFrame`
- `engine3.js` — sprite scaling, `squeeze()`, scenes 1–2 (hook, pick)
- `engine4.js` — scenes 3–5 (learn, sam, offer), `trialPanel()`, scene 0 (flash) + `SCENE_FN`
- `engine5.js` — loading, playback, scrubbing, in-browser export, DOM wiring
- `part6.html` — closing tags

## Workflow

```powershell
cd marketing
.\build.ps1                          # src/ -> ad.html
.\render.ps1                         # both cuts x four aspects -> out/*.mp4 (~2min)
.\render.ps1 -Cuts offerfirst        # one cut
.\render.ps1 -Formats 16x9           # one aspect
.\render.ps1 -Fps 60 -KeepFrames
```

To eyeball one frame without rendering, open
`ad.html?bare=1&cut=offerfirst&fmt=9x16&t=7.9` — `bare` strips the previewer
UI, `cut` picks the edit (default `full`), `t` freezes that second. That's how
every layout check was done. The previewer has buttons for all of it.

## The spot — two cuts, 15.00s each, 450 frames @30fps

Both are defined as data in `CUTS` (`src/engine1.js`). They share every scene
function; only the running order and the durations differ.

### `full` — the original, title first

| Scene | Start | Content |
|---|---|---|
| hook | 0.00 | CRT power-on, headline types out, Portland + all ages, mascot idle |
| pick | 2.60 | Character-select, cards slide in, cursor walks 01→02→03 and presses |
| learn | 5.80 | 10 subjects fired one at a time, menu fills in beneath |
| sam | 8.60 | Pixelated portrait, "HI, I'M SAM", 10+ years line |
| offer | 10.80 | 1 FREE TRIAL LESSON → $40/half hour → BOOK NOW → samhall.music |

### `offerfirst` — the offer in second one

| Scene | Start | Content |
|---|---|---|
| flash | 0.00 | Fast power-on, then the trial panel + MUSIC & MEDIA LESSONS / PORTLAND, OR |
| hook | 1.80 | Same title card, starting **warm** — no power-on, types from frame one |
| learn | 4.40 | Same, 0.6s longer |
| sam | 7.80 | Same, 0.4s longer |
| offer | 10.40 | Same, 0.4s longer |

Why: in the full cut the offer does not appear until 10.8s, and most of the
feed is gone by three. This cut says FREE TRIAL LESSON before anyone has
decided to scroll, and still closes on BOOK NOW for whoever stays — which also
means the Reels loop lands on the offer twice.

`pick` is what paid for those seconds. It is the one scene that sells nothing
`learn` does not sell more directly, and dropping it meant **no other scene had
to get shorter** — so not one internal timing constant had to be retuned. The
full cut still has it; that is what the A/B is for.

Silent by design (feed autoplays muted). Both hold at the end because Reels
loops.

## Output

All eight are H.264 / yuv420p / 15.000s / 450 frames, silent AAC track,
`+faststart`. Verified with ffprobe.

The full cut keeps its original filenames so nothing already uploaded moves;
the new one takes an `-offerfirst` infix.

- `samhall-ad-9x16.mp4` / `samhall-ad-offerfirst-9x16.mp4` 1080×1920 — Reels/Stories **(essential)**
- `samhall-ad-4x5.mp4` / `samhall-ad-offerfirst-4x5.mp4` 1080×1350 — Feed **(essential)**
- `…-1x1.mp4` 1080×1080 — optional; Marketplace, right column
- `…-16x9.mp4` 1920×1080 — in-stream / Audience Network; mainly useful off Meta (YouTube, site embed)

Upload per-placement rather than letting Advantage+ auto-crop one file — the
console shell is a full-bleed frame and auto-crop slices the bezel and tray.

## Design constraints worth not re-learning

- **Every size is fitted or proportional.** `fitSize`/`fitLines`/`fitParagraph`/`squeeze`
  exist because fixed sizes broke on the short-wide cuts. Don't hardcode px.
- **Chrome scales off `min(dw, dh)`.** Off width alone, 16:9's deck wanted 226px in a
  977px-tall device.
- **`isWide(s)` = `s.w/s.h > 1.45`** switches every scene to a column layout. 1:1 counts
  as wide: the deck, controls and tray eat enough height that the screen rect comes out
  wider than 1.45.
- **Pixel art only scales by whole numbers** (`snap`/`snapDown`), matching `--px` on the site.
- **The portrait downscales with smoothing OFF** — nearest-neighbour *is* the pixelation
  effect the site uses.
- **The instrument GIFs are baked into 2-frame strips** and stepped from the spot's own
  clock. A GIF in an `<img>` animates on wall-clock time and would drift against a
  frame-by-frame render.
- Type is sized for a phone, not a monitor: headline ≈47px on a 400px-wide screen.
- **The trial panel's type is bound by the panel's WIDTH**, so making the panel taller
  does not make the words bigger — it just grows empty blue around them. That is why
  the flash card's height fractions look modest.
- **Scene functions take `(s, lt, t, sc)`** — `sc` is the entry from the cut's scene
  list, which is how `hook` knows to start warm in `offerfirst`. A new per-cut variation
  belongs there as a flag, not as a new scene function.

## Tooling installed

- **ffmpeg** 9.0.1 via `winget install Gyan.FFmpeg --scope user`. Not on PATH until a
  shell restart; `render.ps1` finds it by absolute path anyway.
- **Node was NOT installed** — Windows Defender quarantines the Node.js zip mid-extract
  (`0x800700e2`), consistently. Don't retry it. `render.ps1` drives Chrome's DevTools
  Protocol straight from PowerShell instead (WebSocket + `Runtime.evaluate` +
  `canvas.toDataURL`), which is frame-exact rather than a real-time capture.

## Open / next

1. **Instagram + Page setup** — mid-flight. Wants the ad to run from a new *business*
   IG, not the personal one. Ads run from a **Facebook Page** identity; the IG account
   is a second identity layered on. Order: create Page → create new IG (separate email)
   → switch to Professional/Business → add both to the Business Portfolio → link IG to
   Page → confirm ad account/payment/pixel are in the *same* portfolio → set **Identity
   at the ad level**. An Ads Manager ad never posts to a profile grid; only boosting
   does.
2. **Ad copy drafted, not chosen** — now written down in `ad-copy.md`: 5 primary texts,
   5 headlines, 5 descriptions, the destination URL with UTMs, and a suggested pairing
   per cut. All of it came from `lessons.html` / `about.html` / `index.html`. Still
   needs a human to pick.
3. **New IG account will be empty.** Studio photos are in `assets/photos/`; stills come
   from the previewer's "Save this frame".
4. **The two cuts are an A/B, not a replacement.** Put both in the *same* ad set with
   the same copy and let Meta rotate them; splitting them across ad sets at a small
   daily budget means neither gets enough data to mean anything. A static frame exported
   from the offer scene is worth adding as a third ad.
5. **Google Business Profile is not set up.** Free, and for "music lessons near me" in
   Portland it is likely to beat paid social per dollar. Raised, not done.

## Measurement limits (flagged, not fixed)

- The pixel (`1128133582979107`, `js/pixel.js`) is **consent-gated** — nothing fires
  until the visitor clicks "Sure". Correct privacy behaviour, but Meta undercounts.
- **`PageView` is the only event.** The booking widget is MyMusicStaff's third-party
  script, so a completed booking is invisible.
- Therefore: **optimise for Landing Page Views or Link Clicks, not Conversions.** Meta
  wants ~50 conversions/week to leave the learning phase and a local lessons business
  won't hit that. Judge success by trials actually booked in MyMusicStaff.
- Adding a booking-completion event was offered and **declined** (2026-09-22). It would
  have meant asking MyMusicStaff for a redirect-on-success URL and firing a `Lead` on
  the page it lands on. Don't re-propose it unless asked — the decision was made with
  the tradeoff on the table.
- Also raised, not acted on: the consent gate is opt-*in*, which is stricter than
  Oregon law asks for a Portland-only audience. Switching it to opt-out would recover
  most of the traffic Meta cannot currently see. That is a values call, not a bug.

## Facts used in the creative

$40 per half hour · first trial lesson free for every new student · home studio near the
Columbia Slough, Portland OR · all ages, all skill levels · 10+ years · no books, no
recitals · drums, guitar, bass, ukulele, piano, synths, production, animation, video,
photo. All from the live site.
