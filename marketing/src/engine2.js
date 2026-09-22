
/* --- The console shell ---------------------------------------------------- */
/* Drawn every frame, identical to the site's .device / .deck / .bezel /
   .screen / .controls / .tray stack. Returns the screen rect the scenes
   paint into. Kept generous at top and bottom so the Reels and Stories
   overlays never sit on top of anything that matters. */

function drawShell(t) {
  /* room */
  rect(0, 0, W, H, C.room);
  ctx.globalAlpha = .5;
  for (let y = 0; y < H; y += 10) rect(0, y, W, 2, 'rgba(255,255,255,.05)');
  for (let x = 0; x < W; x += 10) rect(x, 0, 2, H, 'rgba(255,255,255,.05)');
  ctx.globalAlpha = 1;

  const dx = Math.round(W * FMT.padX);
  const dy = Math.round(H * FMT.padT);
  const dw = W - dx * 2;
  const dh = H - dy - Math.round(H * FMT.padB);

  /* Every piece of furniture is sized off the SMALLER device dimension. Off
     width alone, a 16:9 device 1804 wide but only 977 tall would want a 226px
     deck and eat its own screen. For the tall cuts u is the width, so those
     are unchanged. Horizontal POSITIONS still key off dw. */
  const u = Math.min(dw, dh);

  /* shell, with the inset orange/dark bevel from .device */
  rect(dx, dy, dw, dh, C.shell);
  rect(dx, dy, 8, dh, C.shellL);
  rect(dx + dw - 8, dy, 8, dh, C.shellD);

  /* --- deck ------------------------------------------------------------- */
  const deckH = Math.round(u * .125);
  rect(dx, dy + deckH - 8, dw, 8, C.shellD);

  const padIn = Math.round(dw * .045);
  let cx = dx + padIn;
  const midY = dy + deckH / 2;

  /* LED, on the .blip cadence */
  const blip = (t % 3.2) / 3.2;
  const ledOn = !(blip > .92 && blip < .96);
  const ledS = Math.round(u * .014);
  rect(cx - 4, midY - ledS / 2 - 4, ledS + 8, ledS + 8, C.shellD);
  ctx.globalAlpha = ledOn ? 1 : .35;
  rect(cx, midY - ledS / 2, ledS, ledS, C.led);
  ctx.globalAlpha = 1;
  cx += ledS + Math.round(u * .028);

  /* cartridge mark */
  const markS = Math.round(u * .042);
  sprite(IMG.cartridge, cx, midY - markS / 2, markS, markS);
  cx += markS + Math.round(u * .026);

  /* brand block */
  const nameS = fitSize('SAM HALL', dw * .42, Math.round(u * .039), PIXEL, .04);
  const subS  = Math.round(nameS * .74);
  const blockH = nameS + Math.round(nameS * .55) + subS;
  text('SAM HALL', cx, midY - blockH / 2, nameS, C.onShell, 'left', PIXEL, .04);
  text('MUSIC & DIGITAL MEDIA', cx, midY - blockH / 2 + nameS + Math.round(nameS * .55),
       subS, '#fce4d5', 'left', SANS, .1);

  /* --- bezel + screen ---------------------------------------------------- */
  const ctrlH = Math.round(u * .075);
  const trayH = Math.round(u * .085);
  const bm = Math.round(u * .030);          /* .bezel margin */
  const bp = Math.round(u * .013);          /* .bezel padding */

  const bzX = dx + bm, bzY = dy + deckH + bm;
  const bzW = dw - bm * 2;
  const bzH = dh - deckH - ctrlH - trayH - bm * 2;

  notched(bzX, bzY, bzW, bzH, C.bezel, Math.round(bp * 1.6), C.shell);
  const s = { x: bzX + bp, y: bzY + bp, w: bzW - bp * 2, h: bzH - bp * 2, n: Math.round(bp * 1.2) };
  notched(s.x, s.y, s.w, s.h, C.screen, Math.round(bp * 1.2), C.bezel);

  /* --- controls ---------------------------------------------------------- */
  const cY = dy + dh - trayH - ctrlH;
  const dpad = Math.round(ctrlH * .62);
  const dpX = dx + padIn, dpY = cY + (ctrlH - dpad) / 2;
  rect(dpX, dpY + dpad / 2 - dpad * .18, dpad, dpad * .36, C.shellD);
  rect(dpX + dpad / 2 - dpad * .18, dpY, dpad * .36, dpad, C.shellD);

  const btnS = Math.round(ctrlH * .30);
  const bX = dx + dw - padIn - btnS * 2 - Math.round(dw * .022);
  ctx.globalAlpha = .95;
  box(bX, cY + (ctrlH - btnS) / 2, btnS, btnS, C.accent, C.shellD, 4, 0);
  box(bX + btnS + Math.round(dw * .022), cY + (ctrlH - btnS) / 2, btnS, btnS, C.highlight, C.shellD, 4, 0);
  ctx.globalAlpha = 1;

  const gX = dpX + dpad + Math.round(dw * .04);
  const gW = bX - gX - Math.round(dw * .04);
  ctx.globalAlpha = .85;
  for (let y = 0; y < ctrlH * .34; y += 8) rect(gX, cY + ctrlH * .33 + y, gW, 4, C.shellD);
  ctx.globalAlpha = 1;

  /* --- tray -------------------------------------------------------------- */
  const tY = dy + dh - trayH;
  rect(dx, tY, dw, 6, C.shellD);
  const urlS = fitSize('SAMHALL.MUSIC', dw * .46, Math.round(u * .040), PIXEL, .04);
  text('SAMHALL.MUSIC', dx + padIn, tY + (trayH - urlS) / 2 + 6, urlS, C.onShell, 'left', PIXEL, .04);
  text('FREE TRIAL LESSON', dx + dw - padIn, tY + (trayH - urlS) / 2 + 10, Math.round(urlS * .82),
       '#fce4d5', 'right', SANS, .1);

  return s;
}

/* CRT scanlines, laid over the screen once the scene is painted */
function scanlines(s) {
  ctx.save();
  ctx.beginPath(); ctx.rect(s.x, s.y, s.w, s.h); ctx.clip();
  ctx.fillStyle = 'rgba(42,38,34,.055)';
  for (let y = 0; y < s.h; y += 6) ctx.fillRect(s.x, s.y + y, s.w, 2);
  ctx.restore();
}

/* --- Frame ---------------------------------------------------------------- */

function drawFrame(t) {
  t = clamp(t, 0, DUR);
  const s = drawShell(t);

  /* which scene, and how far into it */
  let idx = 0, acc = 0;
  for (let i = 0; i < SCENES.length; i++) {
    if (t < acc + SCENES[i].dur || i === SCENES.length - 1) { idx = i; break; }
    acc += SCENES[i].dur;
  }
  const lt = t - acc;

  ctx.save();
  ctx.beginPath(); ctx.rect(s.x, s.y, s.w, s.h); ctx.clip();
  SCENE_FN[SCENES[idx].id](s, lt, t, SCENES[idx]);

  /* hard cut with a one-flash tail, the way a console swaps screens */
  if (idx > 0 && lt < .09) {
    ctx.globalAlpha = 1 - lt / .09;
    rect(s.x, s.y, s.w, s.h, C.screen);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  scanlines(s);

  /* scenes paint edge to edge, so the screen corners get re-cut on top */
  rect(s.x, s.y, s.n, s.n, C.bezel);
  rect(s.x + s.w - s.n, s.y, s.n, s.n, C.bezel);
  rect(s.x, s.y + s.h - s.n, s.n, s.n, C.bezel);
  rect(s.x + s.w - s.n, s.y + s.h - s.n, s.n, s.n, C.bezel);
}
