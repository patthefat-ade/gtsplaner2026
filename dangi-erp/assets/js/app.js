/* ==========================================================================
   DANGI ERP – app.js
   Vanilla JavaScript: Mobile-Navigation, Positionen-Editor für
   Angebote/Rechnungen (Dienstleistungen übernehmen, Summen berechnen).
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- Mobile-Navigation ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  /* ---------- Untermenü-Gruppen (Dropdown) ---------- */
  document.querySelectorAll(".nav-group-btn").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var li = btn.closest(".nav-group");
      var wasOpen = li.classList.contains("open");
      document.querySelectorAll(".nav-group.open").forEach(function (g) {
        if (g !== li) { g.classList.remove("open"); var b = g.querySelector(".nav-group-btn"); if (b) b.setAttribute("aria-expanded", "false"); }
      });
      li.classList.toggle("open", !wasOpen);
      btn.setAttribute("aria-expanded", !wasOpen ? "true" : "false");
    });
  });
  /* Klick auf einen Untermenüpunkt schließt das Dropdown (Desktop) */
  document.querySelectorAll(".nav-sub a").forEach(function (a) {
    a.addEventListener("click", function () {
      var g = a.closest(".nav-group");
      if (g && window.innerWidth > 920) {
        g.classList.remove("open");
        var b = g.querySelector(".nav-group-btn"); if (b) b.setAttribute("aria-expanded", "false");
      }
    });
  });
  document.addEventListener("click", function (e) {
    if (window.innerWidth > 920 && !e.target.closest(".nav-group")) {
      document.querySelectorAll(".nav-group.open").forEach(function (g) {
        g.classList.remove("open");
        var b = g.querySelector(".nav-group-btn"); if (b) b.setAttribute("aria-expanded", "false");
      });
    }
  });

  /* ---------- Positionen-Editor (nur auf Dokument-Formular aktiv) ---------- */
  var itemsBody = document.getElementById("items-body");
  if (!itemsBody) return;

  var services = [];
  var dataEl = document.getElementById("services-data");
  if (dataEl) {
    try { services = JSON.parse(dataEl.textContent); } catch (e) { services = []; }
  }

  var rowIndex = itemsBody.querySelectorAll("tr.item-row").length;

  function fmt(v) {
    return v.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }

  function parseNum(input) {
    var v = String(input.value || "0").replace(",", ".");
    var n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function recalc() {
    var total = 0;
    itemsBody.querySelectorAll("tr.item-row").forEach(function (row) {
      var qty = parseNum(row.querySelector(".f-qty"));
      var price = parseNum(row.querySelector(".f-price"));
      var line = Math.round(qty * price * 100) / 100;
      total += line;
      row.querySelector(".col-total").textContent = fmt(line);
    });
    var totalEl = document.getElementById("doc-total");
    if (totalEl) totalEl.textContent = fmt(total);
  }

  function addRow(data) {
    data = data || {};
    var tr = document.createElement("tr");
    tr.className = "item-row";
    tr.innerHTML =
      '<td>' +
        '<input type="hidden" name="items[' + rowIndex + '][service_id]" value="' + (data.service_id || "") + '">' +
        '<input type="text" name="items[' + rowIndex + '][title]" class="f-title" required placeholder="Titel der Leistung" value="">' +
        '<textarea name="items[' + rowIndex + '][description]" class="f-desc" placeholder="Beschreibung (optional)"></textarea>' +
      '</td>' +
      '<td class="col-qty"><input type="text" inputmode="decimal" name="items[' + rowIndex + '][quantity]" class="f-qty" value="' + (data.quantity || "1") + '"></td>' +
      '<td class="col-unit"><input type="text" name="items[' + rowIndex + '][unit]" class="f-unit" value=""></td>' +
      '<td class="col-price"><input type="text" inputmode="decimal" name="items[' + rowIndex + '][unit_price]" class="f-price" value="' + (data.unit_price || "0,00") + '"></td>' +
      '<td class="col-total">0,00 €</td>' +
      '<td class="col-del"><button type="button" class="item-del" title="Position entfernen">×</button></td>';
    itemsBody.appendChild(tr);
    // Textwerte sicher setzen (kein HTML-Injection-Risiko)
    tr.querySelector(".f-title").value = data.title || "";
    tr.querySelector(".f-desc").value = data.description || "";
    tr.querySelector(".f-unit").value = data.unit || "Pauschale";
    rowIndex++;
    recalc();
  }

  /* Leistung aus Katalog übernehmen */
  var serviceSelect = document.getElementById("service-select");
  var serviceAddBtn = document.getElementById("service-add");
  if (serviceAddBtn && serviceSelect) {
    serviceAddBtn.addEventListener("click", function () {
      var id = parseInt(serviceSelect.value, 10);
      if (!id) return;
      var s = services.find(function (x) { return x.id === id; });
      if (!s) return;
      addRow({
        service_id: s.id,
        title: s.title,
        description: s.description || "",
        unit: s.unit || "Pauschale",
        quantity: "1",
        unit_price: String(s.unit_price).replace(".", ",")
      });
      serviceSelect.value = "";
    });
  }

  /* Freie Position */
  var freeAddBtn = document.getElementById("item-add");
  if (freeAddBtn) {
    freeAddBtn.addEventListener("click", function () { addRow(); });
  }

  /* Entfernen + Neuberechnung (Event-Delegation) */
  itemsBody.addEventListener("click", function (e) {
    if (e.target.classList.contains("item-del")) {
      e.target.closest("tr").remove();
      recalc();
    }
  });
  itemsBody.addEventListener("input", function (e) {
    if (e.target.classList.contains("f-qty") || e.target.classList.contains("f-price")) {
      recalc();
    }
  });

  /* Mindestens eine Position beim Absenden */
  var form = document.getElementById("doc-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      if (!itemsBody.querySelector("tr.item-row")) {
        e.preventDefault();
        alert("Bitte mindestens eine Position hinzufügen.");
      }
    });
  }

  recalc();
})();
