
/* ========================================================================== */
/* 3 - LEARN: one subject at a time, big, with the menu filling in below.      */
/* ========================================================================== */

const ITEMS = [
  ['DRUMS', 'drums'], ['GUITAR', 'guitar'], ['BASS', 'bass'],
  ['UKULELE', 'ukulele'], ['PIANO', 'piano'],
  ['PRODUCTION', 'digitalmusic'], ['SYNTHS', 'synth'], ['ANIMATION', 'animation'],
  ['VIDEO', 'videography'], ['PHOTO', 'photography']
];
const L_START = .07, L_STEP = .225;

function sLearn(s, lt) {
  const pad = s.w * .055, maxW = s.w - pad * 2, mid = s.x + s.w / 2;

  const hs = fitSize('LEARN ANY OF THIS', maxW, Math.round(Math.min(s.w * .078, s.h * .10)), PIXEL, .01);
  const top = s.y + s.h * .045;
  const hp = cue(lt, 0, .12, 3);
  text('LEARN ANY OF THIS', mid, top - (1 - hp) * 14, hs, C.ink, 'center', PIXEL, .01, hp);

  /* Everything under the header is divided by proportion, not by fixed sizes.
     The square cut's screen is short and wide, and tiles measured off the
     WIDTH alone swallowed it — leaving the subject icon at its floor and the
     word sitting on top of the menu. Height gets a say in every size now. */
  const zTop = top + hs * 1.6 + s.h * .02;
  const region = (s.y + s.h - s.h * .045) - zTop;

  /* the running menu, capped to about a third of the space and centred.
     Landscape has width to spare and no height, so it runs as one row. */
  const cols = isWide(s) ? ITEMS.length : 5, rows = Math.ceil(ITEMS.length / cols);
  const g = Math.round(Math.min(s.w * .022, region * .045));
  const tile = Math.round(Math.min((maxW - g * (cols - 1)) / cols,
                                   (region * .34 - g * (rows - 1)) / rows));
  const trayW = tile * cols + g * (cols - 1);
  const trayH = tile * rows + g * (rows - 1);
  const trayX = mid - trayW / 2;
  const trayY = s.y + s.h - s.h * .045 - trayH;

  const i = clamp(Math.floor((lt - L_START) / L_STEP), -1, ITEMS.length - 1);

  for (let k = 0; k < ITEMS.length; k++) {
    if (k > i) break;
    const p = cue(lt, L_START + k * L_STEP, .10, 3);
    const tx = trayX + (k % cols) * (tile + g);
    const ty = trayY + Math.floor(k / cols) * (tile + g);
    const live = k === i;
    ctx.globalAlpha = p;
    box(tx, ty, tile, tile, live ? C.highlight : C.panel, C.ink,
        Math.max(3, Math.round(tile * .05)), Math.max(3, Math.round(tile * .06)), C.ink);
    icon(IMG[ITEMS[k][1]], tx + tile / 2, ty + tile / 2, tile * .58);
    ctx.globalAlpha = 1;
  }

  /* the current subject, in whatever the header and the menu leave over */
  if (i < 0) return;
  const word = ITEMS[i][0], key = ITEMS[i][1];
  const gapW = Math.round(region * .03), gapT = Math.round(region * .05);
  const upper = region - trayH - gapT;
  const p = cue(lt, L_START + i * L_STEP, .10, 3);

  /* Stacked in a tall frame. Landscape sets the icon and the word side by
     side instead — height is the scarce thing there, width is not, and
     stacking them wastes both. Sizes floor onto the 16px grid so the sprite
     stays a whole-number upscale. */
  let big, ws, iconX, iconY, wordX, wordY, wordAlign;

  if (isWide(s)) {
    big = 16 * Math.max(3, Math.floor(Math.min(upper * .86, s.w * .22) / 16));
    ws = Math.round(Math.min(
      fitSize(word, maxW - big - s.w * .06, Math.round(s.w * .155), PIXEL, .01),
      upper * .42));
    const rowGap = Math.round(s.w * .035);
    const rowW = big + rowGap + widthOf(word, ws, PIXEL, ws * .01);
    iconX = mid - rowW / 2;
    iconY = zTop + (upper - big) / 2;
    wordX = iconX + big + rowGap;
    wordY = zTop + (upper - ws * .78) / 2;
    wordAlign = 'left';
  } else {
    ws = Math.round(Math.min(fitSize(word, maxW, Math.round(s.w * .155), PIXEL, .01),
                             region * .16));
    big = 16 * Math.max(3, Math.floor(Math.min(upper - ws * 1.25 - gapW, s.w * .42) / 16));
    const bY = zTop + Math.max(0, (upper - (big + gapW + ws * 1.25)) / 2);
    iconX = mid - big / 2; iconY = bY;
    wordX = mid; wordY = bY + big + gapW;
    wordAlign = 'center';
  }

  const icx = iconX + big / 2, icy = iconY + big / 2;
  ctx.save();
  ctx.globalAlpha = Math.min(1, p * 1.8);
  const k2 = lerp(.78, 1, p);
  ctx.translate(icx, icy); ctx.scale(k2, k2); ctx.translate(-icx, -icy);
  sprite(IMG[key], iconX, iconY, big, big);
  ctx.restore();

  text(word, wordX, wordY + (1 - p) * 14, ws,
       C.accent, wordAlign, PIXEL, .01, Math.min(1, p * 1.8));
}

/* ========================================================================== */
/* 4 - SAM: the face behind it, so the ad is not only furniture.               */
/* ========================================================================== */

function sSam(s, lt) {
  const pad = s.w * .06, maxW = s.w - pad * 2, mid = s.x + s.w / 2;

  /* Portrait over text in a tall frame; portrait beside text in a wide one,
     which is the only way both stay big enough to read. */
  const wide = isWide(s);

  /* The portrait is a big image of a coarse pixel grid, and the site shows it
     shrunk with image-rendering:pixelated — that nearest-neighbour downscale
     IS the effect. Land on a whole-number divisor so every source block is
     sampled the same way, and leave smoothing off. */
  const pw = Math.round(snapDown(1066, wide ? Math.min(s.w * .26, s.h * .62)
                                            : Math.min(s.w * .44, s.h * .32)));
  const textW = wide ? Math.round(s.w * .44) : maxW;
  const hs = fitSize("HI, I'M SAM", textW, Math.round(Math.min(s.w * .095, s.h * .16)), PIXEL, .01);
  const copy = '10+ years of teaching + making experience';
  const f = fitParagraph(copy, textW, s.h * (wide ? .40 : .30),
                         Math.round(Math.min(s.w * .080, s.h * .13)), SANS, 1.5);
  const gapA = s.h * (wide ? .030 : .045), gapB = s.h * .012;
  const textH = hs * 1.5 + gapB + f.lines.length * f.size * 1.5;

  /* the flanking sprites are part of the portrait's block, so the whole band
     centres as one thing rather than the portrait drifting off-centre */
  const gs = snap(76, Math.min(s.w * (wide ? .07 : .15), pw * .42));
  const gGap = s.w * (wide ? .014 : .045);

  /* where the portrait sits, and where the words start */
  let pX, pY, tX, tY, tAlign;
  if (wide) {
    const colGap = s.w * .045;
    const leftW = pw + 2 * (gGap + gs);
    const bandX = mid - (leftW + colGap + textW) / 2;
    pX = bandX + (leftW - pw) / 2;
    pY = s.y + (s.h - pw) / 2;
    tX = bandX + leftW + colGap + textW / 2;
    tY = s.y + (s.h - textH) / 2;
    tAlign = 'center';
  } else {
    const blockH = pw + gapA + textH;
    pY = s.y + Math.max(s.h * .035, (s.h - blockH) / 2);
    pX = mid - pw / 2;
    tX = mid;
    tY = pY + pw + gapA;
    tAlign = 'center';
  }

  const pp = cue(lt, .04, .16, 3);
  if (pp > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, pp * 1.8);
    const k = lerp(.82, 1, pp);
    const cxp = pX + pw / 2;
    ctx.translate(cxp, pY + pw / 2); ctx.scale(k, k); ctx.translate(-cxp, -(pY + pw / 2));
    sprite(IMG.portrait, pX, pY, pw, pw);
    ctx.restore();
  }

  /* The two instrument sprites that flank the name on the home page. They ship
     as 2-frame GIFs, but a GIF in an <img> animates on wall-clock time, which
     would drift against a frame-by-frame render — so they are baked into
     2-frame strips and stepped from the spot's own clock instead. */
  const gp = cue(lt, .20, .16, 3);
  if (gp > 0) {
    const cxp = pX + pw / 2;
    const off = pw / 2 + gGap + gs / 2;
    const gy = pY + pw * .62 - gs / 2;
    const gf = Math.floor((lt / .5) % 2);      /* the GIFs' own 500ms cadence */
    ctx.globalAlpha = gp;
    sprite(IMG.inst1, cxp - off - gs / 2, gy, gs, gs, gf * 76, 0, 76, 76);
    sprite(IMG.inst2, cxp + off - gs / 2, gy, gs, gs, (1 - gf) * 76, 0, 76, 76);
    ctx.globalAlpha = 1;
  }

  let y = tY;
  const hp = cue(lt, .36, .14, 3);
  if (hp > 0) text("HI, I'M SAM", tX, y - (1 - hp) * 16, hs, C.accent, tAlign, PIXEL, .01, hp);
  y += hs * 1.5 + gapB;

  const bp = cue(lt, .58, .18, 3);
  if (bp > 0) {
    f.lines.forEach(function (l, i) {
      text(l, tX, y + i * f.size * 1.5, f.size, C.ink, tAlign, SANS, 0, bp);
    });
  }
}

/* ========================================================================== */
/* The .trial panel - the blue box with the offer in it. The offer scene and   */
/* the offer-first cut's opening card both draw it, so it lives on its own.    */
/* `inset` is passed rather than worked out here: the two callers sit in       */
/* differently shaped holes, and the type has to be fitted to the hole.        */
/* ========================================================================== */

function trialPanel(x, y, w, h, bw, sh, inset) {
  box(x, y, w, h, C.highlight, C.ink, bw, sh, C.ink);
  const mid = x + w / 2;
  const iw = w - bw * 2 - inset;
  /* fitSize only guards width; squeeze the stack so it clears the border too */
  const k = squeeze([
    [fitSize('EVERY NEW STUDENT GETS', iw, Math.round(h * .14), SANS, .06), 1.34],
    [fitSize('1 FREE', iw, Math.round(h * .42), PIXEL, .02), 1.20],
    [fitSize('TRIAL LESSON', iw, Math.round(h * .22), PIXEL, .02), 1.12]
  ], h - bw * 2);
  let ty = y + (h - k.h) / 2;
  text('EVERY NEW STUDENT GETS', mid, ty, k.s[0], C.ink, 'center', SANS, .06); ty += k.a[0];
  text('1 FREE', mid, ty, k.s[1], C.ink, 'center', PIXEL, .02);                ty += k.a[1];
  text('TRIAL LESSON', mid, ty, k.s[2], C.ink, 'center', PIXEL, .02);
}

/* ========================================================================== */
/* 0 - FLASH: the offer-first cut's opening card.                              */
/*     The whole argument for that cut is that somebody who gives the spot     */
/*     two seconds should still have read FREE TRIAL LESSON, so the tube       */
/*     powers on in an eighth of a second and the panel lands on top of it.    */
/*     The caption under it is the only other thing on screen: what the        */
/*     lesson is and where it is, because a free offer with no noun is not an  */
/*     offer. Everything else the shell is already saying in the deck.         */
/* ========================================================================== */

function sFlash(s, lt) {
  /* a faster power-on than the hook's - every tenth spent here is the offer's */
  if (lt < .13) {
    rect(s.x, s.y, s.w, s.h, '#0d0b0a');
    const hh = lerp(10, s.h, ease(lt / .13));
    rect(s.x, s.y + (s.h - hh) / 2, s.w, hh, C.screen);
    return;
  }

  const wide = isWide(s);
  const pad = s.w * .055, maxW = s.w - pad * 2, mid = s.x + s.w / 2;
  const bw = Math.max(5, Math.round(Math.min(s.w, s.h) * .0075));
  const sh = Math.round(Math.min(s.w, s.h) * .015);

  /* The caption is measured first and the panel takes what is left over, so
     the panel can never push the words off the bottom of a short screen. */
  const cap = wide ? ['MUSIC & MEDIA LESSONS · PORTLAND, OR']
                   : ['MUSIC & MEDIA LESSONS', 'PORTLAND, OR'];
  const cs = fitLines(cap, maxW, Math.round(Math.min(s.w * .052, s.h * .072)), PIXEL, .02);
  const clh = Math.round(cs * 1.55);
  const capH = cap.length * clh;
  const gap = Math.round(s.h * .05);

  /* Landscape caps the panel's width off the HEIGHT, the same reflex as the
     shell: left to the full width it becomes a letterbox with three words in
     it and the type ends up smaller than it is on a phone. */
  /* The height fractions look modest because the type inside is bound by the
     panel's WIDTH, not its height: past this the box just grows empty blue
     around a stack that cannot get any bigger. */
  const panelW = wide ? Math.round(Math.min(maxW, s.h * 1.45)) : maxW;
  const panelH = Math.round(Math.min(s.h - capH - gap - s.h * .09,
                                     s.h * (wide ? .56 : .46)));
  const blockH = panelH + gap + capH;
  const y0 = s.y + (s.h - blockH) / 2;

  slam(mid, y0 + panelH / 2, lt, .10, function () {
    trialPanel(mid - panelW / 2, y0, panelW, panelH, bw, sh, s.w * .05);
  });

  cap.forEach(function (l, i) {
    const p = cue(lt, .50 + i * .10, .16, 3);
    if (p > 0) text(l, mid, y0 + panelH + gap + i * clh + (1 - p) * 14, cs,
                    C.accent2, 'center', PIXEL, .02, p);
  });
}

/* ========================================================================== */
/* 5 - OFFER: the free trial, the price, and where to go. Held long enough     */
/*     to be read at a glance, because Reels loops straight back to the top.   */
/* ========================================================================== */

function sOffer(s, lt) {
  const wide = isWide(s);
  const pad = s.w * .055, maxW = s.w - pad * 2;
  const mid = s.x + s.w / 2;
  const bw = Math.max(5, Math.round(Math.min(s.w, s.h) * .0075));
  const sh = Math.round(Math.min(s.w, s.h) * .015);

  /* One column stacked in a tall frame. In a wide one the offer takes the
     left half and the price, button and address stack down the right, which
     keeps every panel the same size it would have been vertically. */
  const colGap = Math.round(s.w * .035);
  const colW   = wide ? Math.round((maxW - colGap) / 2) : maxW;
  const x      = s.x + pad;
  const x2     = x + colW + colGap;
  const midL   = wide ? x + colW / 2 : mid;
  const midR   = wide ? x2 + colW / 2 : mid;

  const trialH = Math.round(wide ? s.h * .62 : s.h * .275);
  const rateH  = Math.round(wide ? s.h * .40 : s.h * .255);
  const btnH   = Math.round(wide ? s.h * .16 : s.h * .105);
  const g1 = Math.round(s.h * (wide ? .045 : .035));
  const g2 = Math.round(s.h * .045);
  const urlS = fitSize('SAMHALL.MUSIC', colW * .9,
                       Math.round(Math.min(s.w * .085, s.h * .11)), PIXEL, .03);

  const leftH  = trialH;
  const rightH = rateH + g1 + btnH + g2 + urlS * 1.2;
  const total  = wide ? Math.max(leftH, rightH) : trialH + g1 + rateH + g1 + btnH + g2 + urlS * 1.2;
  const y0 = s.y + Math.max(s.h * .035, (s.h - total) / 2);
  let y = wide ? s.y + (s.h - rightH) / 2 : y0;

  /* --- .trial ----------------------------------------------------------- */
  const tY = wide ? s.y + (s.h - trialH) / 2 : y;
  slam(midL, tY + trialH / 2, lt, .08, function () {
    trialPanel(x, tY, colW, trialH, bw, sh, s.w * .04);
  });
  if (!wide) y += trialH + g1;

  /* --- .rate ------------------------------------------------------------ */
  const rY = y;
  slam(midR, rY + rateH / 2, lt, .46, function () {
    box(wide ? x2 : x, rY, colW, rateH, C.panel, C.ink, bw, sh, C.ink);
    const iw = colW - bw * 2 - s.w * .04;
    const k = squeeze([
      [fitSize('LESSONS ARE', iw, Math.round(rateH * .13), PIXEL, .02), 1.95],
      [fitSize('$40', iw, Math.round(rateH * .46), PIXEL, .01), 1.40],
      [fitSize('PER HALF HOUR', iw, Math.round(rateH * .15), PIXEL, .02), 1.10]
    ], rateH - bw * 2);
    let ry = rY + (rateH - k.h) / 2;
    text('LESSONS ARE', midR, ry, k.s[0], C.inkSoft, 'center', PIXEL, .02); ry += k.a[0];
    text('$40', midR, ry, k.s[1], C.accent, 'center', PIXEL, .01);          ry += k.a[1];
    text('PER HALF HOUR', midR, ry, k.s[2], C.ink, 'center', PIXEL, .02);
  });
  y += rateH + g1;

  /* --- .btn ------------------------------------------------------------- */
  const bp = cue(lt, .82, .16, 3);
  if (bp > 0) {
    /* the button's own :active nudge, on a slow loop so the CTA keeps moving */
    const beat = lt > 1.5 && ((lt - 1.5) % 1.1) < .13;
    const nudge = beat ? sh * .6 : 0;
    const bsh = beat ? Math.round(sh * .35) : sh;
    const bWid = Math.round(colW * .78);
    const bX = midR - bWid / 2 + nudge, bY = y + nudge;
    ctx.globalAlpha = Math.min(1, bp * 1.8);
    box(bX, bY, bWid, btnH, C.highlight, C.ink, bw, bsh, C.ink);
    const ts = fitSize('BOOK NOW', bWid * .52, Math.round(btnH * .40), PIXEL, .03);
    const ic = snap(16, btnH * .40);
    const tw = widthOf('BOOK NOW', ts, PIXEL, ts * .03);
    const gp2 = Math.round(Math.min(s.w, s.h) * .03);
    const sx = midR + nudge - (ic + gp2 + tw) / 2;
    sprite(IMG.calendar, sx, bY + btnH / 2 - ic / 2, ic, ic);
    text('BOOK NOW', sx + ic + gp2, bY + btnH / 2 - ts * .55, ts, C.ink, 'left', PIXEL, .03);
    ctx.globalAlpha = 1;
  }
  y += btnH + g2;

  /* --- the address, with a terminal cursor after it ---------------------- */
  const up = cue(lt, 1.02, .16, 3);
  if (up > 0) {
    const w = widthOf('SAMHALL.MUSIC', urlS, PIXEL, urlS * .03);
    text('SAMHALL.MUSIC', midR, y + (1 - up) * 12, urlS, C.accent2, 'center', PIXEL, .03, up);
    if ((lt * 3) % 2 < 1.15) {
      ctx.globalAlpha = up;
      rect(midR + w / 2 + urlS * .2, y, urlS * .72, urlS, C.accent2);
      ctx.globalAlpha = 1;
    }
  }
}

var SCENE_FN = { flash: sFlash, hook: sHook, pick: sPick, learn: sLearn, sam: sSam, offer: sOffer };
