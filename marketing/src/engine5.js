
/* ========================================================================== */
/* Driver: loading, playback, scrubbing, and export.                          */
/* ========================================================================== */

var IMG = {};
var cv, scrub, timeEl, statusEl, loopBox, fmtKey = '9x16';
var playing = false, cur = 0, raf = 0, startedAt = 0, recording = false;

function status(msg, bad) {
  statusEl.textContent = msg || '';
  statusEl.className = 'status' + (bad ? ' bad' : '');
}

function loadAll() {
  var keys = Object.keys(ART);
  var imgs = keys.map(function (k) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = im.onerror = function () { IMG[k] = im; res(); };
      im.src = ART[k];
      /* the two instrument sprites are GIFs: an <img> only keeps animating
         while it is attached to the document, so park them off-screen */
      im.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px';
      document.body.appendChild(im);
    });
  });
  var fonts = Promise.resolve();
  if (document.fonts) {
    fonts = Promise.all([
      document.fonts.load('120px "Press Start 2P"'),
      document.fonts.load('40px "Press Start 2P"'),
      document.fonts.load('120px "DotGothic16"'),
      document.fonts.load('40px "DotGothic16"')
    ]).then(function () { return document.fonts.ready; }).catch(function () {});
  }
  return Promise.all([Promise.all(imgs), fonts]);
}

function setFormat(key) {
  fmtKey = key;
  FMT = FORMATS[key];
  W = FMT.w; H = FMT.h;
  cv.width = W; cv.height = H;
  ctx = cv.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  var btns = document.querySelectorAll('[data-fmt]');
  for (var i = 0; i < btns.length; i++)
    btns[i].setAttribute('aria-pressed', btns[i].dataset.fmt === key ? 'true' : 'false');
  render(cur);
}

function render(t) {
  cur = clamp(t, 0, DUR);
  ctx.imageSmoothingEnabled = false;
  drawFrame(cur);
  if (!recording) {
    scrub.value = String(cur.toFixed(3));
    timeEl.textContent = cur.toFixed(2) + ' / ' + DUR.toFixed(2) + 's';
  }
}

function tick() {
  if (!playing) return;
  var t = (performance.now() - startedAt) / 1000;
  if (t >= DUR) {
    render(DUR);
    if (loopBox.checked) { play(0); } else { playing = false; syncPlay(); }
    return;
  }
  render(t);
  raf = requestAnimationFrame(tick);
}

function play(from) {
  cancelAnimationFrame(raf);
  var at = from != null ? from : (cur >= DUR - .02 ? 0 : cur);
  startedAt = performance.now() - at * 1000;
  playing = true;
  syncPlay();
  raf = requestAnimationFrame(tick);
}

function pause() { playing = false; cancelAnimationFrame(raf); syncPlay(); }
function syncPlay() { document.getElementById('play').textContent = playing ? 'Pause' : 'Play'; }

/* --- Export --------------------------------------------------------------- */

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  var want = ['video/mp4;codecs=avc1.4d002a', 'video/mp4;codecs=avc1', 'video/mp4',
              'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (var i = 0; i < want.length; i++)
    if (MediaRecorder.isTypeSupported(want[i])) return want[i];
  return '';
}

/* Both cuts get exported, so the name has to say which one this is. The full
   cut keeps its original filename, so nothing already uploaded moves. */
function cutTag() { return CUT_KEY === 'full' ? '' : '-' + CUT_KEY; }

function save(blob, name) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 6000);
}

function record() {
  var mime = pickMime();
  if (!mime) { status('This browser cannot record. Use Chrome or Edge.', true); return; }
  pause();
  recording = true;
  document.body.classList.add('rec');
  status('Recording ' + DUR.toFixed(0) + 's - keep this tab visible and in front.');

  render(0);
  var stream = cv.captureStream(FPS);
  var chunks = [];
  var rec;
  try {
    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 14000000 });
  } catch (e) {
    rec = new MediaRecorder(stream, { mimeType: mime });
  }
  rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = function () {
    var ext = mime.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
    var blob = new Blob(chunks, { type: mime });
    var name = 'samhall-ad' + cutTag() + '-' + fmtKey + '.' + ext;
    save(blob, name);
    recording = false;
    document.body.classList.remove('rec');
    status('Saved ' + name + ' (' +
           Math.round(blob.size / 1048576 * 10) / 10 + ' MB).' +
           (ext === 'webm' ? ' Your browser only does WebM - convert it to MP4 before uploading.' : ''));
    render(0);
  };

  rec.start();
  var began = performance.now();
  (function frame() {
    var t = (performance.now() - began) / 1000;
    if (t >= DUR) {
      render(DUR);
      /* let the last frame land in the stream before closing it off */
      setTimeout(function () { try { rec.stop(); } catch (e) {} }, 200);
      return;
    }
    render(t);
    requestAnimationFrame(frame);
  })();
}

function poster() {
  cv.toBlob(function (b) {
    save(b, 'samhall-still' + cutTag() + '-' + fmtKey + '-' +
            cur.toFixed(1).replace('.', 'p') + 's.png');
    status('Saved the current frame as a PNG.');
  }, 'image/png');
}

/* --- Cuts ----------------------------------------------------------------- */
/* The scene list is what changes between cuts, so everything keyed off it --
   the scrubber's range and the chapter chips -- gets rebuilt here. */

function buildChapters() {
  var nav = document.getElementById('chapters');
  nav.innerHTML = '';
  var acc = 0;
  SCENES.forEach(function (sc) {
    var at = acc;
    var b = document.createElement('button');
    b.className = 'chip';
    b.textContent = sc.id;
    b.addEventListener('click', function () { pause(); render(at + .001); });
    nav.appendChild(b);
    acc += sc.dur;
  });
}

function useCut(key) {
  setCut(key);
  scrub.max = String(DUR);
  buildChapters();
  var btns = document.querySelectorAll('[data-cut]');
  for (var i = 0; i < btns.length; i++)
    btns[i].setAttribute('aria-pressed', btns[i].dataset.cut === CUT_KEY ? 'true' : 'false');
  render(clamp(cur, 0, DUR));
}

/* --- Wiring --------------------------------------------------------------- */

window.addEventListener('DOMContentLoaded', function () {
  cv = document.getElementById('stage');
  scrub = document.getElementById('scrub');
  timeEl = document.getElementById('time');
  statusEl = document.getElementById('status');
  loopBox = document.getElementById('loop');

  ctx = cv.getContext('2d', { alpha: false });

  document.getElementById('play').addEventListener('click', function () {
    playing ? pause() : play();
  });
  document.getElementById('restart').addEventListener('click', function () { play(0); });
  document.getElementById('rec').addEventListener('click', record);
  document.getElementById('png').addEventListener('click', poster);
  scrub.addEventListener('input', function () { pause(); render(parseFloat(scrub.value)); });

  var btns = document.querySelectorAll('[data-fmt]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function (e) {
      var was = playing;
      pause();
      setFormat(e.currentTarget.dataset.fmt);
      if (was) play(cur);
    });
  }

  var cuts = document.querySelectorAll('[data-cut]');
  for (var j = 0; j < cuts.length; j++) {
    cuts[j].addEventListener('click', function (e) {
      var was = playing;
      pause();
      useCut(e.currentTarget.dataset.cut);
      if (was) play(0);
    });
  }

  status('Loading art and fonts...');
  loadAll().then(function () {
    /* ?fmt=9x16&t=3.4 freezes one frame, for grabbing stills or eyeballing
       a single beat without scrubbing to it */
    var q = new URLSearchParams(location.search);
    if (q.has('bare')) document.body.classList.add('bare');
    /* format first: useCut renders, and there is nothing to render into
       until setFormat has sized the canvas and picked FMT. */
    var f = q.get('fmt');
    setFormat(FORMATS[f] ? f : '9x16');
    useCut(q.get('cut') || 'full');
    if (q.has('t')) {
      render(parseFloat(q.get('t')) || 0);
      status('Held at ' + cur.toFixed(2) + 's.');
    } else {
      status(pickMime().indexOf('mp4') >= 0
        ? 'Ready. Record exports a 1080p MP4.'
        : 'Ready. This browser records WebM - Chrome or Edge will give you MP4.');
      play(0);
    }
    document.body.dataset.ready = '1';
  });
});
