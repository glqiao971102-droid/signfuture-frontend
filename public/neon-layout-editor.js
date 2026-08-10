/*
 * Neon page layout editor (temporary tool).
 * Toggle "Edit Layout" to drag (move) and resize every frame freely, then click
 * Export to copy the arrangement. Send that back and the layout gets baked into
 * real CSS; this file/script tag is then removed.
 *
 * External file on purpose: the neon page HTML is a JS template literal, so
 * inline scripts there can't use backticks / ${ } / regex escapes. Here they can.
 */
(function () {
  var SELECTOR =
    ".preview-panel, .design-summary, .step-panel, .color-picker, .collect-date-panel, .checkout-panel";
  var editing = false;
  var toolbar = null;
  var exportBox = null;

  function panels() {
    return Array.prototype.slice.call(document.querySelectorAll(SELECTOR));
  }

  function readTranslate(el) {
    var m = /translate\(\s*(-?[0-9.]+)px\s*,\s*(-?[0-9.]+)px\s*\)/.exec(el.style.transform || "");
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
  }

  function frameId(el, i) {
    if (!el.dataset.editid) {
      var label = (el.className || "frame").split(" ")[0];
      el.dataset.editid = label + "-" + i;
    }
    return el.dataset.editid;
  }

  function applyMode() {
    panels().forEach(function (p, i) {
      if (editing) {
        frameId(p, i);
        p.style.outline = "2px dashed #35d8ff";
        p.style.outlineOffset = "-1px";
        p.style.resize = "both";
        p.style.overflow = "auto";
        p.style.cursor = "move";
        p.style.position = "relative";
        p.style.zIndex = "5";
        if (!p.style.transform) p.style.transform = "translate(0px, 0px)";
        attachDrag(p);
      } else {
        p.style.outline = "";
        p.style.outlineOffset = "";
        p.style.resize = "";
        p.style.overflow = "";
        p.style.cursor = "";
        p.style.zIndex = "";
      }
    });
    document.body.style.userSelect = editing ? "none" : "";
  }

  function attachDrag(p) {
    if (p.__editDrag) return;
    p.__editDrag = true;
    p.addEventListener("mousedown", function (e) {
      if (!editing) return;
      var r = p.getBoundingClientRect();
      // Leave the bottom-right corner free for the native resize handle.
      if (e.clientX > r.right - 20 && e.clientY > r.bottom - 20) return;
      // Don't hijack real controls (inputs, buttons, selects).
      if (e.target.closest("input, select, textarea, button, a, label")) return;
      e.preventDefault();
      var base = readTranslate(p);
      var sx = e.clientX;
      var sy = e.clientY;
      function move(ev) {
        p.style.transform =
          "translate(" + (base.x + ev.clientX - sx) + "px, " + (base.y + ev.clientY - sy) + "px)";
      }
      function up() {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      }
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  }

  function exportLayout() {
    var data = panels().map(function (p, i) {
      var t = readTranslate(p);
      var r = p.getBoundingClientRect();
      return {
        frame: frameId(p, i),
        moveX: Math.round(t.x),
        moveY: Math.round(t.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    });
    var text = JSON.stringify(data, null, 2);
    if (!exportBox) {
      exportBox = document.createElement("textarea");
      exportBox.readOnly = true;
      exportBox.style.cssText =
        "position:fixed;bottom:14px;right:14px;width:340px;height:230px;z-index:2147483647;" +
        "background:#0b1220;color:#9fe6ff;border:1px solid #35d8ff;border-radius:8px;padding:8px;" +
        "font-family:monospace;font-size:11px;box-shadow:0 12px 40px rgba(0,0,0,.5)";
      document.body.appendChild(exportBox);
    }
    exportBox.value = text;
    exportBox.style.display = "block";
    exportBox.select();
    try {
      navigator.clipboard.writeText(text);
    } catch (e) {}
  }

  function resetLayout() {
    panels().forEach(function (p) {
      p.style.transform = "";
      p.style.width = "";
      p.style.height = "";
    });
    if (exportBox) exportBox.style.display = "none";
  }

  function button(label) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText =
      "padding:8px 12px;border-radius:8px;border:1px solid #35d8ff;background:#0b1220;" +
      "color:#d7ecff;font-weight:800;font-size:12px;cursor:pointer;font-family:sans-serif";
    return b;
  }

  function ensureUI() {
    if (toolbar) return;
    toolbar = document.createElement("div");
    toolbar.style.cssText =
      "position:fixed;top:14px;right:14px;z-index:2147483647;display:flex;gap:8px;flex-wrap:wrap";
    var edit = button("🔧 Edit Layout: OFF");
    var exp = button("📋 Export");
    var reset = button("↺ Reset");
    toolbar.appendChild(edit);
    toolbar.appendChild(exp);
    toolbar.appendChild(reset);
    document.body.appendChild(toolbar);
    edit.addEventListener("click", function () {
      editing = !editing;
      edit.textContent = "🔧 Edit Layout: " + (editing ? "ON" : "OFF");
      edit.style.background = editing ? "#12324a" : "#0b1220";
      applyMode();
    });
    exp.addEventListener("click", exportLayout);
    reset.addEventListener("click", resetLayout);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureUI);
  } else {
    ensureUI();
  }
})();
