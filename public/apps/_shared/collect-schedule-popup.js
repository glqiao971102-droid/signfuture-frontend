/*
 * Collect Date schedule popup — shared across every storefront calculator
 * (box-up, neon, and the static sticker/banner/poster/… apps).
 *
 * Clicking a ".collect-date-option" opens that option's full schedule board big,
 * with a dynamic "Order today (<date>) → Ready to collect by <date>" line and a
 * Close button the customer taps. The collect-by date comes from the backend
 * working-day engine (/api/v1/collect-estimate; Sundays + public holidays skipped),
 * the same source as the box-up "Estimated ready by" notice.
 *
 * It reads the option key from `data-collect` (box-up buttons) OR the radio
 * `input` value (static labels), so it fits both markups. It is iframe-aware:
 * ProductFrame sizes the app iframe to its content height and the PARENT scrolls,
 * so a plain position:fixed modal would pin to the tall iframe top — instead the
 * overlay is positioned over the parent's visible viewport (mirrors box-up's
 * placeModalInViewport). It suppresses the app's own image-zoom modal only for the
 * collect-date magnifier (so there is never a double popup) while leaving normal
 * tile selection / pricing untouched.
 */
(function () {
  if (window.__sfCollectPopup) return;
  window.__sfCollectPopup = true;

  var API = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:3333"
    : "https://api.signfuturegroup.com";
  var MAP = { standard7: 7, normal: 4, quick3: 3, rush2: 2, next: 1 };
  var DATA = null;

  function load() {
    fetch(API + "/api/v1/collect-estimate")
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.estimates) DATA = j; })
      .catch(function () {});
  }
  function keyOf(opt) {
    var k = opt.getAttribute && opt.getAttribute("data-collect");
    if (k) return k;
    var inp = opt.querySelector && opt.querySelector("input");
    return inp ? inp.value : null;
  }
  function nOf(opt) { var k = keyOf(opt); return (k && MAP[k]) ? MAP[k] : null; }
  function estOf(n) { return (DATA && DATA.estimates && DATA.estimates[n]) ? DATA.estimates[n] : null; }
  function esc(s) { var d = document.createElement("div"); d.textContent = (s == null ? "" : String(s)); return d.innerHTML; }
  function fmtToday() {
    try { return new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "numeric" }); }
    catch (_e) { return ""; }
  }

  // --- parent scroll lock + viewport positioning (content-sized iframe) ---------
  function embedded() {
    try { return !!(window.parent && window.parent !== window && window.frameElement); }
    catch (_e) { return false; }
  }
  function lockParent(locked) {
    try {
      if (window.parent && window.parent !== window) {
        var s = locked ? "hidden" : "";
        window.parent.document.documentElement.style.overflow = s;
        window.parent.document.body.style.overflow = s;
      }
    } catch (_e) {}
  }
  function viewportH() {
    try { return embedded() ? window.parent.innerHeight : window.innerHeight; } catch (_e) { return window.innerHeight; }
  }
  function place(o) {
    var card = o.querySelector(".sf-collect-pop-card");
    if (embedded()) {
      try {
        var iframeTop = window.frameElement.getBoundingClientRect().top + window.parent.scrollY;
        var visTop = window.parent.scrollY - iframeTop; // top of the parent's visible viewport, in iframe-doc coords
        o.style.position = "absolute";
        o.style.left = "0";
        o.style.top = visTop + "px";
        o.style.width = "100%";
        o.style.height = window.parent.innerHeight + "px";
      } catch (_e) {
        o.style.position = "fixed"; o.style.left = "0"; o.style.top = "0"; o.style.width = "100%"; o.style.height = "100%";
      }
    } else {
      o.style.position = "fixed"; o.style.left = "0"; o.style.top = "0"; o.style.width = "100%"; o.style.height = "100%";
    }
    if (card) card.style.maxHeight = Math.max(240, Math.round(viewportH() * 0.92)) + "px";
  }

  var POP = null, REFLOW = null;
  function closePop() {
    if (!POP) return;
    POP.style.display = "none";
    lockParent(false);
    if (REFLOW) {
      try { window.parent.removeEventListener("scroll", REFLOW); window.parent.removeEventListener("resize", REFLOW); } catch (_e) {}
      window.removeEventListener("resize", REFLOW);
      REFLOW = null;
    }
  }
  function buildPop() {
    if (POP) return POP;
    var o = document.createElement("div");
    o.className = "sf-collect-pop";
    o.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;";
    o.innerHTML =
      '<div class="sf-collect-pop-bg" style="position:absolute;inset:0;background:rgba(2,8,20,0.82);"></div>' +
      '<div class="sf-collect-pop-card" style="position:relative;max-width:min(1040px,95vw);max-height:92vh;overflow:auto;background:#060d1c;border:1px solid rgba(53,216,255,0.42);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,0.6);">' +
      '<button type="button" class="sf-collect-pop-close" aria-label="Close" style="position:absolute;top:10px;right:10px;z-index:2;width:40px;height:40px;border-radius:50%;border:1px solid rgba(53,216,255,0.55);background:#0a1830;color:#dbeeff;font-size:22px;line-height:36px;text-align:center;cursor:pointer;padding:0;">&times;</button>' +
      '<img class="sf-collect-pop-img" alt="Collect date schedule" style="display:block;width:100%;height:auto;border-radius:16px 16px 0 0;background:#060d1c;">' +
      '<div class="sf-collect-pop-note" style="padding:14px 18px 18px;color:#eaf4ff;font-size:14px;line-height:1.55;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;"></div>' +
      '</div>';
    document.body.appendChild(o);
    o.querySelector(".sf-collect-pop-close").addEventListener("click", closePop);
    o.querySelector(".sf-collect-pop-bg").addEventListener("click", closePop);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" || e.keyCode === 27) closePop(); });
    POP = o;
    return o;
  }
  function openPop(opt) {
    var o = buildPop();
    var img = opt.querySelector("img");
    var src = img && (img.currentSrc || img.src);
    var pimg = o.querySelector(".sf-collect-pop-img");
    if (src) { pimg.src = src; pimg.style.display = "block"; } else { pimg.removeAttribute("src"); pimg.style.display = "none"; }
    var n = nOf(opt), e = n ? estOf(n) : null, today = fmtToday();
    var html;
    if (e) {
      html = '<div style="font-weight:800;font-size:15px;color:#aee9ff;">📅 Order today' + (today ? (" (" + esc(today) + ")") : "") + '</div>' +
        '<div style="margin-top:4px;font-size:16px;font-weight:800;">Ready to collect by ' + esc(e.display) + '</div>' +
        '<div style="margin-top:7px;color:#9fb4d0;font-size:12.5px;">Sundays and public holidays are skipped. This is an estimate based on the current production queue.</div>';
    } else {
      html = '<div style="font-weight:700;color:#aee9ff;">📅 Find today’s row in the board above for your collection day.</div>' +
        '<div style="margin-top:6px;color:#9fb4d0;font-size:12.5px;">Sundays and public holidays are skipped.</div>';
    }
    o.querySelector(".sf-collect-pop-note").innerHTML =
      '<div style="flex:1 1 220px;min-width:0;">' + html + '</div>' +
      '<button type="button" class="sf-collect-pop-ok" style="flex:0 0 auto;margin-left:auto;padding:11px 32px;border-radius:11px;border:1px solid rgba(53,216,255,0.65);background:linear-gradient(135deg,#1f6fff,#35d8ff);color:#061024;font-weight:800;font-size:15px;letter-spacing:0.05em;cursor:pointer;box-shadow:0 6px 18px rgba(31,111,255,0.4);">OK</button>';
    o.querySelector(".sf-collect-pop-ok").addEventListener("click", closePop);
    o.style.display = "flex";
    place(o);
    lockParent(true);
    REFLOW = function () { if (POP && POP.style.display !== "none") place(POP); };
    try { window.parent.addEventListener("scroll", REFLOW, { passive: true }); window.parent.addEventListener("resize", REFLOW); } catch (_e) {}
    window.addEventListener("resize", REFLOW);
  }

  // Capture phase: open our popup on any collect-date click, and ONLY for the
  // magnifier suppress the app's own image-zoom modal (so there's never a double
  // popup). Tile-body clicks are left to flow so native radio selection + pricing
  // keep working.
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var opt = t.closest(".collect-date-option");
    if (!opt || opt.classList.contains("is-disabled")) return;
    openPop(opt);
    // Magnifier/zoom cue inside the tile: suppress the app's own image preview so
    // ours is the only popup. Covers the static apps / box-up (.image-zoom-button)
    // and neon (.collect-date-zoom).
    if (t.closest(".image-zoom-button") || t.closest(".collect-date-zoom")) { e.stopPropagation(); }
  }, true);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
})();
