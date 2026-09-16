/* Meta (Facebook) Pixel, behind a consent gate.
   -------------------------------------------------------------------------
   Nothing is sent to Facebook until the visitor presses Accept. Until then
   no Facebook script is downloaded and no cookie is written, which is what
   UK/EU rules ask for.

   The choice is remembered in localStorage (first-party, not a cookie, never
   leaves the browser). Visitors can change it any time from the Privacy page.

   Your Pixel ID is below. It is the only setting here, and it is fine for it
   to be public — it is not a secret. */

(function () {
  var PIXEL_ID = '2345514679584033';
  var STORE_KEY = 'sh-consent';

  /* localStorage throws in some private-browsing modes, so every touch of it
     is wrapped — a failure just means we re-ask next visit. */
  function read() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }
  function write(value) {
    try { localStorage.setItem(STORE_KEY, value); } catch (e) {}
  }

  function loadPixel() {
    if (window.fbq) return;
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window,document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');

    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
  }

  /* Facebook sets _fbp / _fbc once it loads. Withdrawing consent has to
     clear them too, or the visitor stays tagged after saying no. */
  function clearFbCookies() {
    var domains = ['', '.' + location.hostname, location.hostname];
    ['_fbp', '_fbc'].forEach(function (name) {
      domains.forEach(function (domain) {
        document.cookie = name + '=; Max-Age=0; path=/' +
          (domain ? '; domain=' + domain : '');
      });
    });
  }

  function decide(value) {
    write(value);
    if (value === 'granted') { loadPixel(); return; }

    clearFbCookies();
    /* If the pixel was already running from an earlier Yes, only a reload
       actually gets the script out of the page. */
    if (window.fbq) location.reload();
  }

  /* --- The banner ------------------------------------------------------- */

  function buildBanner() {
    var wrap = document.createElement('div');
    wrap.className = 'consent';
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Cookie notice');
    wrap.innerHTML =
      '<div class="consent-inner">' +
        '<p class="consent-copy">' +
          'Can I use cookies to see how many people find this site? ' +
          'It only counts visits — nothing you type, and nothing personal. ' +
          '<a href="privacy.html">Which cookies, and why</a>' +
        '</p>' +
        '<div class="consent-btns">' +
          '<button class="btn" type="button" data-consent="granted">Sure</button>' +
          '<button class="btn btn--ghost" type="button" data-consent="denied">No thanks</button>' +
        '</div>' +
      '</div>';

    wrap.addEventListener('click', function (event) {
      var button = event.target.closest('[data-consent]');
      if (!button) return;
      decide(button.getAttribute('data-consent'));
      wrap.remove();
    });

    return wrap;
  }

  function showBanner() {
    if (document.querySelector('.consent')) return;
    document.body.appendChild(buildBanner());
  }

  /* --- Start ------------------------------------------------------------ */

  function start() {
    /* Let the Privacy page reopen the choice: any element with
       data-consent-reset clears the stored answer and shows the banner. */
    var reset = document.querySelector('[data-consent-reset]');
    if (reset) {
      reset.addEventListener('click', function () {
        try { localStorage.removeItem(STORE_KEY); } catch (e) {}
        showBanner();
      });
    }

    var choice = read();
    if (choice === 'granted') { loadPixel(); return; }
    if (choice === 'denied') return;

    /* Browsers sending Global Privacy Control are opting out for the
       visitor already, so take that as the answer and don't nag. */
    if (navigator.globalPrivacyControl) { decide('denied'); return; }

    showBanner();
  }

  /* The tag is async, so the body may not exist yet. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
