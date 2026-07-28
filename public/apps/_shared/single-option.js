/* Locks any option control that offers a single choice.
 *
 * A dropdown you cannot choose within is noise, so it reads as a plain
 * read-only field instead - matching the disabled "Choose Material" select
 * on the Display System pages.
 *
 * Covers both control shapes used by these calculators:
 *   - native <select> (visible ones; the mirrors inside .native-select-hidden
 *     are driven by a picker and never shown)
 *   - the collapsible [data-picker] + .choice card grids
 *
 * Re-evaluated on DOM changes: several pages rebuild their option lists when
 * an upstream choice changes (e.g. Poster hides Canvas unless UV Ink), so a
 * control can gain or lose choices after load.
 */
(function () {
  var LOCK = "data-single-locked";

  /* Only ever unlock what we locked, so page logic that disables a control
     for its own reasons is left alone. */
  function setLocked(el, locked) {
    if (locked) {
      if (!el.disabled) {
        el.disabled = true;
        el.setAttribute(LOCK, "");
      }
    } else if (el.hasAttribute(LOCK)) {
      el.disabled = false;
      el.removeAttribute(LOCK);
    }
  }

  function syncSelects() {
    var list = document.querySelectorAll("select");
    for (var i = 0; i < list.length; i++) {
      var sel = list[i];
      if (sel.closest(".native-select-hidden")) continue;
      var open = 0;
      for (var j = 0; j < sel.options.length; j++) {
        if (!sel.options[j].disabled) open++;
      }
      setLocked(sel, open <= 1);
    }
  }

  function syncPickers() {
    var list = document.querySelectorAll("[data-picker]");
    for (var i = 0; i < list.length; i++) {
      var picker = list[i];
      var toggle = picker.querySelector("button");
      if (!toggle) continue;
      var cards = picker.querySelectorAll(".choice");
      var shown = 0;
      for (var j = 0; j < cards.length; j++) {
        if (!cards[j].hidden) shown++;
      }
      var locked = shown <= 1;
      if (locked && picker.classList.contains("is-open")) {
        picker.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
      setLocked(toggle, locked);
    }
  }

  function sync() {
    syncSelects();
    syncPickers();
  }

  function injectStyle() {
    var css =
      "select[" + LOCK + "],[" + LOCK + "].product-toggle,[" + LOCK + "].finishing-toggle{" +
      "opacity:.8;cursor:default;}" +
      "[" + LOCK + "].product-toggle::after,[" + LOCK + "].finishing-toggle::after{opacity:.55;}";
    var tag = document.createElement("style");
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function start() {
    injectStyle();
    sync();
    /* attributeFilter is limited to the flags that can change how many
       choices are on offer - anything wider would fire on every repaint. */
    new MutationObserver(sync).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "hidden"],
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
