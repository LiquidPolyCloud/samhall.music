
/* --- Sprite scaling ------------------------------------------------------- */
/* Pixel art only ever goes up by a whole number, same rule as --px on the
   site, so the source grid never lands between output pixels. */
function snap(nat, target) { return nat * Math.max(1, Math.round(target / nat)); }
function snapDown(nat, target) {
  let d = Math.max(1, Math.round(nat / target));
  if (nat / d > target * 1.08) d++;   /* a little over is fine; a lot is not */
  return nat / d;
}

function icon(img, cx, cy, target) {
  const sz = snap(16, target);
  sprite(img, cx - sz / 2, cy - sz / 2, sz, sz);
}

/* Shrink a stack of type so it clears the box it sits in. Takes [size, advance]
   pairs, returns the scaled sizes, the advance after each, and the total. */
function squeeze(rows, avail) {
  let total = 0;
  rows.forEach(function (r) { total += r[0] * r[1]; });
  const k = Math.min(1, avail * .94 / total);
  return {
    s: rows.map(function (r) { return r[0] * k; }),
    a: rows.map(function (r) { return r[0] * r[1] * k; }),
    h: total * k
  };
}

function slam(cx, cy, t, at, fn, len) {
  const p = cue(t, at, len || .16, 3);
  if (p <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, p * 1.7);
  const k = lerp(1.13, 1, p);
  ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
  fn();
  ctx.restore();
}

/* ========================================================================== */
/* 1 — HOOK: the console powers on and types its own title card.              */
/* ========================================================================== */

function sHook(s, lt, t, sc) {
  /* The offer-first cut has already powered the tube on during its own
     opening card, so there this scene starts warm and types from the first
     frame. Every cue after the headline is left where it was. */
  const warm = !!(sc && sc.warm);

  /* CRT power-on: a hairline opens, then unfolds to fill the tube */
  if (!warm) {
    if (lt < .24) {
      rect(s.x, s.y, s.w, s.h, '#0d0b0a');
      if (lt < .07) {
        const w = s.w * ease(lt / .07);
        rect(s.x + (s.w - w) / 2, s.y + s.h / 2 - 6, w, 12, C.screen);
      } else {
        const hh = lerp(12, s.h, ease((lt - .07) / .17));
        rect(s.x, s.y + (s.h - hh) / 2, s.w, hh, C.screen);
      }
      return;
    }
    if (lt < .34) {
      ctx.globalAlpha = (.34 - lt) / .10;
      rect(s.x, s.y, s.w, s.h, '#ffffff');
      ctx.globalAlpha = 1;
    }
  }

  const pad = s.w * .06, maxW = s.w - pad * 2, mid = s.x + s.w / 2;

  /* h1, broken short so it can be set big enough to read on a phone */
  /* four short lines stack beautifully in a tall frame and not at all in a
     wide one, so landscape sets the same words two to a line */
  const L = isWide(s) ? ['MUSIC & DIGITAL', 'MEDIA LESSONS']
                      : ['MUSIC &', 'DIGITAL', 'MEDIA', 'LESSONS'];
  const hs = fitLines(L, maxW, Math.round(Math.min(s.w * .135, s.h * .20)), PIXEL, .01);
  const lh = Math.round(hs * 1.40);
  const top = s.y + s.h * .055;

  const typed = Math.floor(Math.max(0, lt - (warm ? .02 : .30)) * 34);
  let seen = 0, curLine = -1, curStr = '';
  for (let i = 0; i < L.length; i++) {
    const left = typed - seen;
    if (left <= 0) break;
    const str = L[i].slice(0, left);
    text(str, mid, top + i * lh, hs, C.accent, 'center', PIXEL, .01);
    if (left <= L[i].length) { curLine = i; curStr = str; }
    seen += L[i].length + 1;   /* one beat spent on each line break */
  }
  if (curLine >= 0 && (lt * 7) % 2 < 1.2) {
    const w = widthOf(curStr, hs, PIXEL, hs * .01);
    rect(mid + w / 2 + hs * .12, top + curLine * lh, hs * .8, hs, C.accent);
  }

  let y = top + L.length * lh + s.h * .028;

  /* .rule, drawn outward from the middle */
  const rp = cue(lt, 1.20, .16, 4);
  if (rp > 0) {
    const rw = maxW * rp, unit = Math.max(4, Math.round(s.w * .012));
    dashRule(mid - rw / 2, y, rw, unit, C.line);
  }
  y += s.h * .045;

  /* .tagline */
  const T = isWide(s) ? ['PORTLAND, OR · ALL AGES & ALL LEVELS']
                      : ['PORTLAND, OR', 'ALL AGES & ALL LEVELS'];
  const ts = fitLines(T, maxW, Math.round(Math.min(s.w * .062, s.h * .095)), PIXEL, .02);
  const tlh = Math.round(ts * 1.6);
  T.forEach((l, i) => {
    const p = cue(lt, 1.36 + i * .12, .14, 3);
    if (p > 0) text(l, mid, y + i * tlh + (1 - p) * 18, ts, C.accent2, 'center', PIXEL, .02, p);
  });
  y += T.length * tlh + s.h * .02;

  /* the mascot gets whatever room is left, and sits it out if there's none */
  const room = (s.y + s.h - s.h * .03) - y;
  if (room > 90) {
    const p = cue(lt, 1.62, .18, 4);
    if (p > 0) {
      const hgt = snap(30, Math.min(room, s.h * (isWide(s) ? .30 : .20)));
      const wdt = hgt / 30 * 18;
      const f = Math.floor((lt / .225) % 4);
      ctx.globalAlpha = p;
      sprite(IMG.mascotCombat, mid - wdt / 2, y + room - hgt, wdt, hgt, f * 18, 0, 18, 30);
      ctx.globalAlpha = 1;
    }
  }
}

/* ========================================================================== */
/* 2 — PICK: the character-select, cards sliding in and a cursor choosing.     */
/* ========================================================================== */

const CARDS = [
  { n: '01', k: 'guitar',    lines: ['INSTRUMENTS'] },
  { n: '02', k: 'recording', lines: ['DIGITAL', 'MEDIA'] },
  { n: '03', k: 'question',  lines: ["I DON'T", 'KNOW!'] }
];

function sPick(s, lt) {
  const wide = isWide(s);
  const pad = s.w * .055, maxW = s.w - pad * 2, mid = s.x + s.w / 2;

  /* Tall cuts stack the cards and use the site's narrow-screen card: art on
     the left, name on the right. Landscape has the room to run them as the
     three-across grid the site itself uses on a desktop, art above name. */
  const H = wide ? ['CHOOSE YOUR ADVENTURE'] : ['CHOOSE YOUR', 'ADVENTURE'];
  const hs = fitLines(H, maxW, Math.round(Math.min(s.w * .095, s.h * .14)), PIXEL, .01);
  const hlh = Math.round(hs * 1.5);
  const top = s.y + s.h * .04;
  const hp = cue(lt, 0, .14, 3);
  H.forEach((l, i) => text(l, mid, top + i * hlh - (1 - hp) * 18, hs, C.ink, 'center', PIXEL, .01, hp));

  const listTop = top + H.length * hlh + s.h * .035;
  const listBot = s.y + s.h - s.h * .055;
  const gap = Math.round(wide ? s.w * .022 : s.h * .025);
  const cardH = Math.round(wide ? listBot - listTop : (listBot - listTop - gap * 2) / 3);
  const cardW = Math.round(wide ? (maxW - gap * 2) / 3 : maxW);

  /* Card geometry is the same for all three, so it is worked out once — which
     also lets every name plate share ONE type size. Fitting each card on its
     own would set a two-line name larger than a long one-line name, and the
     row would look like a mistake. */
  const bw = Math.max(4, Math.round(Math.min(s.w, s.h) * .0075));
  const artW = wide ? cardW : cardH;
  const artH = wide ? Math.round(cardH * .62) : cardH;
  const artMin = Math.min(artW, artH);
  const labelW = (wide ? cardW - bw * 2 : cardW - artW - bw * 2) - s.w * (wide ? .02 : .06);
  const ls = Math.min.apply(null, CARDS.map(c =>
    fitLines(c.lines, labelW, Math.round(artMin * .26), PIXEL, .01)));

  /* the cursor walks the list, then commits to one */
  const hover = lt >= 2.20 ? 2 : lt >= 1.72 ? 1 : lt >= 1.28 ? 0 : -1;
  const press = lt >= 2.70 && lt < 2.88;

  CARDS.forEach((card, i) => {
    const inT = cue(lt, .10 + i * .13, .22, 4);
    if (inT <= 0) return;
    let x = s.x + pad + (wide ? i * (cardW + gap) : 0) + (1 - inT) * s.w * (wide ? .12 : .6);
    let y = listTop + (wide ? 0 : i * (cardH + gap));
    let sh = Math.round(s.w * .013), shc = C.ink;
    const on = hover === i;
    if (on) { x -= sh / 2; y -= sh / 2; sh = Math.round(s.w * .021); shc = C.highlight; }
    if (on && press) { x += sh; y += sh; sh = Math.round(s.w * .008); }

    ctx.globalAlpha = Math.min(1, inT * 1.6);
    box(x, y, cardW, cardH, C.panel, C.ink, bw, sh, shc);

    /* .select-art — graph paper, icon, and the 01/02/03 plate */
    rect(x + bw, y + bw, artW - bw * (wide ? 2 : 1), artH - bw * (wide ? 1 : 2), C.screen);
    grid(x + bw, y + bw, artW - bw * (wide ? 2 : 1), artH - bw * (wide ? 1 : 2),
         Math.round(artMin * .13), C.line);
    if (wide) rect(x + bw, y + artH, cardW - bw * 2, bw, C.ink);
    else      rect(x + artW, y + bw, bw, cardH - bw * 2, C.ink);
    icon(IMG[card.k], x + artW / 2, y + artH / 2, artMin * .5);

    const ns = Math.round(artMin * .13);
    const nw = widthOf(card.n, ns, PIXEL, 0) + ns * .9;
    rect(x + bw, y + bw, nw, ns * 1.8, C.ink);
    text(card.n, x + bw + ns * .45, y + bw + ns * .4, ns, C.screen, 'left', PIXEL, 0);

    /* .select-label, filling blue when the cursor is on it */
    const lx = wide ? x + bw : x + artW + bw;
    const ly0 = wide ? y + artH + bw : y + bw;
    const lw = wide ? cardW - bw * 2 : cardW - artW - bw * 2;
    const lh = wide ? cardH - artH - bw * 2 : cardH - bw * 2;
    if (on) rect(lx, ly0, lw, lh, C.highlight);
    const llh = Math.round(ls * 1.45);
    const ly = ly0 + lh / 2 - card.lines.length * llh / 2 + llh * .12;
    card.lines.forEach((l, j) =>
      text(l, wide ? lx + lw / 2 : lx + s.w * .03, ly + j * llh, ls, C.ink,
           wide ? 'center' : 'left', PIXEL, .01));

    if (on && press) { ctx.globalAlpha = .55; rect(x, y, cardW, cardH, C.screen); }
    ctx.globalAlpha = 1;
  });

}
