/* ==========================================================================
   Sam Hall — 15-second social spot.
   Everything is drawn from a single pure function of time, so the preview,
   the scrubber and the recorder all show the exact same frames.
   Palette, type and furniture are lifted straight from css/main.css.
   ========================================================================== */

const C = {
  room:'#3d1305', shell:'#b83c11', shellD:'#7d2709', shellL:'#f15a29',
  bezel:'#2a2622', screen:'#fcf8e8', panel:'#f7f1dc', panel2:'#efe7cd',
  ink:'#2a2622', inkSoft:'#6b6357', line:'#ddd3b6',
  accent:'#f15a29', accentInk:'#c53c0c', accent2:'#12718f',
  highlight:'#27aae1', onShell:'#fcf8e8', led:'#9fe4ff'
};
const PIXEL = '"Press Start 2P", monospace';
const SANS  = '"DotGothic16", sans-serif';

const FORMATS = {
  '9x16': { w:1080, h:1920, padX:.030, padT:.085, padB:.135, label:'9:16 — Reels / Stories' },
  '4x5':  { w:1080, h:1350, padX:.035, padT:.040, padB:.045, label:'4:5 — Feed' },
  '1x1':  { w:1080, h:1080, padX:.035, padT:.035, padB:.040, label:'1:1 — Square' },
  '16x9': { w:1920, h:1080, padX:.030, padT:.045, padB:.050, label:'16:9 — Landscape' }
};

const FPS = 30;

/* Two cuts of the same fifteen seconds.

   `full` is the original: the console powers on, types its own title card,
   runs the character-select, and saves the free trial for the end.

   `offerfirst` exists because a feed scroller who gives the spot two seconds
   never reaches the offer at eleven. It opens on the trial card instead, then
   rejoins the same spot. Something had to pay for those seconds and it was
   `pick` — the character-select is the one scene that sells nothing the
   `learn` scene does not sell more directly. The time it frees goes back to
   `learn`, `sam` and `offer`, which is why no scene here is SHORTER than it
   is in the full cut: every scene's internal timing is left exactly alone.

   Both come to 15.00s. Run them against each other; that is the point. */
const CUTS = {
  full: {
    label: 'Full - title first',
    scenes: [
      { id:'hook',  dur:2.60 },
      { id:'pick',  dur:3.20 },
      { id:'learn', dur:2.80 },
      { id:'sam',   dur:2.20 },
      { id:'offer', dur:4.20 }
    ]
  },
  offerfirst: {
    label: 'Offer first - free trial in second one',
    scenes: [
      { id:'flash', dur:1.80 },
      { id:'hook',  dur:2.60, warm:true },
      { id:'learn', dur:3.40 },
      { id:'sam',   dur:2.60 },
      { id:'offer', dur:4.60 }
    ]
  }
};

/* SCENES and DUR are what the rest of the file reads, so switching cuts is
   just a matter of repointing them. */
let CUT_KEY, SCENES, DUR;

function setCut(key) {
  CUT_KEY = CUTS[key] ? key : 'full';
  SCENES = CUTS[CUT_KEY].scenes;
  DUR = SCENES.reduce((a, s) => a + s.dur, 0);
  return CUT_KEY;
}
setCut('full');

/* --- tiny helpers --------------------------------------------------------- */

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const ease  = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/* A landscape screen is short and wide enough that the vertical stacks the
   other cuts use will not fit. Scenes branch on this to lay out in columns. */
const isWide = s => s.w / s.h > 1.45;

/* steps() easing, so movement lands on whole frames like the site's CSS */
const stepEase = (t, steps) => ease(Math.ceil(clamp(t, 0, 1) * steps) / steps);

/* 0 before `at`, ramps to 1 over `len`, quantised to `steps` */
const cue = (t, at, len = .2, steps = 4) => stepEase((t - at) / len, steps);

let ctx, W, H, FMT;

function rect(x, y, w, h, fill) { ctx.fillStyle = fill; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

/* border-box the way the site draws one: solid edge, inset fill */
function box(x, y, w, h, fill, edge, bw, shadow, shadowColor) {
  if (shadow) rect(x + shadow, y + shadow, w, h, shadowColor || C.ink);
  rect(x, y, w, h, edge || C.ink);
  rect(x + bw, y + bw, w - 2 * bw, h - 2 * bw, fill);
}

/* the notched corners of .bezel / .screen — corners knocked out to `under` */
function notched(x, y, w, h, fill, n, under) {
  rect(x, y, w, h, fill);
  rect(x, y, n, n, under);
  rect(x + w - n, y, n, n, under);
  rect(x, y + h - n, n, n, under);
  rect(x + w - n, y + h - n, n, n, under);
}

function setLS(px) { try { ctx.letterSpacing = px + 'px'; } catch (e) {} }

function font(size, fam) { ctx.font = size + 'px ' + (fam || PIXEL); }

function widthOf(str, size, fam, ls) {
  setLS(ls || 0); font(size, fam);
  const w = ctx.measureText(str).width;
  setLS(0);
  return w;
}

/* largest size <= cap at which `str` still fits `maxW`. Every headline in the
   spot goes through this, so no copy can ever run off the screen. */
function fitSize(str, maxW, cap, fam, lsRatio) {
  let size = cap;
  for (let i = 0; i < 40 && size > 8; i++) {
    if (widthOf(str, size, fam, size * (lsRatio || 0)) <= maxW) break;
    size -= Math.max(1, Math.round(size * .04));
  }
  return size;
}

function fitLines(lines, maxW, cap, fam, lsRatio) {
  return Math.min.apply(null, lines.map(l => fitSize(l, maxW, cap, fam, lsRatio)));
}

function text(str, x, y, size, color, align, fam, lsRatio, alpha) {
  const ls = size * (lsRatio || 0);
  setLS(ls); font(size, fam);
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'top';
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.fillText(str, Math.round(x), Math.round(y));
  ctx.globalAlpha = 1;
  setLS(0);
  return ctx.measureText(str).width;
}

/* greedy wrap at a fixed size */
function wrap(str, size, maxW, fam, lsRatio) {
  const words = str.split(' '), out = [];
  let line = '';
  for (const wd of words) {
    const test = line ? line + ' ' + wd : wd;
    if (line && widthOf(test, size, fam, size * (lsRatio || 0)) > maxW) { out.push(line); line = wd; }
    else line = test;
  }
  if (line) out.push(line);
  return out;
}

/* biggest size (<= cap) at which `str` wraps into a block fitting maxW x maxH */
function fitParagraph(str, maxW, maxH, cap, fam, lh) {
  let size = cap;
  for (let i = 0; i < 40 && size > 8; i++) {
    const lines = wrap(str, size, maxW, fam, 0);
    if (lines.length * size * lh <= maxH) return { size, lines };
    size -= Math.max(1, Math.round(size * .05));
  }
  return { size, lines: wrap(str, size, maxW, fam, 0) };
}

/* pixel-art blit, always on whole pixels so the grid stays crisp */
function sprite(img, x, y, w, h, sx, sy, sw, sh) {
  if (!img || !img.complete || !img.naturalWidth) return;
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (sx == null) ctx.drawImage(img, x, y, w, h);
  else ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/* the site's dashed .rule */
function dashRule(x, y, w, unit, color) {
  for (let i = 0; i < w; i += unit * 2) rect(x + i, y, Math.min(unit, w - i), unit, color);
}

/* .select-art's faint graph-paper fill */
function grid(x, y, w, h, step, color) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let i = 0; i <= h; i += step) rect(x, y + i, w, 2, color);
  for (let i = 0; i <= w; i += step) rect(x + i, y, 2, h, color);
  ctx.restore();
}
