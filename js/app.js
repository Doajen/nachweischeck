/**
 * SPA shell: steps + dashboard tiles + one primary CTA.
 * No persist, no analytics.
 */
(function () {
  "use strict";

  var state = {
    ruleset: null,
    copy: null,
    skin: {},
    ready: false,
    step: 1,
    expanded: "rnd",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function t(key) {
    if (!state.copy || state.copy[key] == null) return key;
    return state.copy[key];
  }

  function radioValue(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }

  function optionalNumber(id) {
    var el = $(id);
    if (!el) return null;
    var raw = el.value;
    if (raw === "" || raw == null) return null;
    var n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  function readFacts() {
    var facts = {
      anlass: radioValue("anlass"),
      nutzung: radioValue("nutzung"),
      fertigstellungJahr: optionalNumber("fertigstellungJahr"),
      modernisierung: radioValue("modernisierung"),
      modernisierungJahr: optionalNumber("modernisierungJahr"),
      ausweis: radioValue("ausweis"),
    };
    var anteil = optionalNumber("gebaeudeanteilEur");
    var kauf = optionalNumber("kaufpreisEur");
    var split = optionalNumber("splitPct");
    var grenz = optionalNumber("grenzsatzPct");
    var honorar = optionalNumber("honorarEur");
    var splitA = optionalNumber("splitPctA");
    var splitB = optionalNumber("splitPctB");
    if (anteil != null) facts.gebaeudeanteilEur = anteil;
    if (kauf != null) facts.kaufpreisEur = kauf;
    if (split != null) facts.splitPct = split;
    if (grenz != null) facts.grenzsatzPct = grenz;
    if (honorar != null) facts.honorarEur = honorar;
    if (splitA != null) facts.splitPctA = splitA;
    if (splitB != null) facts.splitPctB = splitB;
    return facts;
  }

  function formatEuro(n) {
    if (!Number.isFinite(n)) return "—";
    return (
      new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(n) + " (Modellrechnung)"
    );
  }

  function formatNum(n, digits) {
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("de-DE", {
      maximumFractionDigits: digits == null ? 1 : digits,
    }).format(n);
  }

  function formatPct(n) {
    if (!Number.isFinite(n)) return "—";
    return String(n).replace(".", ",") + " %";
  }

  function showBanner(msg) {
    var b = $("load-banner");
    b.hidden = false;
    b.textContent = msg;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isDesktop() {
    return window.matchMedia && window.matchMedia("(min-width: 800px)").matches;
  }

  function setStep(n) {
    state.step = Math.max(1, Math.min(3, n));
    var panels = document.querySelectorAll("[data-step-panel]");
    for (var i = 0; i < panels.length; i++) {
      var p = panels[i];
      var sn = Number(p.getAttribute("data-step-panel"));
      if (isDesktop()) {
        p.hidden = false;
      } else {
        p.hidden = sn !== state.step;
      }
    }
    var tabs = document.querySelectorAll(".step-tab");
    for (var j = 0; j < tabs.length; j++) {
      var tab = tabs[j];
      var ts = Number(tab.getAttribute("data-step"));
      if (ts === state.step) tab.setAttribute("aria-current", "step");
      else tab.removeAttribute("aria-current");
    }
    var prev = $("step-prev");
    var next = $("step-next");
    if (prev && next) {
      prev.hidden = state.step <= 1;
      next.hidden = state.step >= 3;
    }
    // Mobile: dashboard after step 2
    var dash = $("results");
    if (dash && state.ready) {
      if (isDesktop() || state.step >= 2) dash.hidden = false;
      else dash.hidden = true;
    }
  }

  function renderCta(lever, slot, labelKey, variant) {
    var url = NC.affiliates.buildUrl(lever, slot);
    var vendor = NC.affiliates.vendorName(lever, slot);
    if (!url) return "";
    var label = t(labelKey);
    var cls = variant === "text" ? "cta cta-text" : "cta cta-button";
    return (
      '<div class="' +
      cls +
      '" data-lever="' +
      escapeHtml(lever) +
      '" data-slot="' +
      escapeHtml(slot) +
      '">' +
      '<p class="cta-werbung">' +
      escapeHtml(t("cta.werbung")) +
      "</p>" +
      '<p class="cta-vertrag">' +
      escapeHtml(t("cta.vertrag")) +
      "</p>" +
      '<a class="cta-link" href="' +
      escapeHtml(url) +
      '" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(label) +
      "</a>" +
      '<p class="cta-print-only">' +
      escapeHtml(vendor) +
      " — " +
      escapeHtml(t("cta.werbung")) +
      "</p>" +
      "</div>"
    );
  }

  /** One primary CTA only (no handoff strip). */
  function renderPrimaryCta(routed) {
    if (routed.rndCta && routed.rndCta.primary) {
      return (
        '<div class="primary-cta-slot">' +
        renderCta("rnd", "primary", "cta.rndPrimary", "button") +
        "</div>"
      );
    }
    if (routed.handoff && routed.handoff.kpa) {
      return (
        '<div class="primary-cta-slot">' +
        renderCta("kpa", "primary", "cta.kpa", "button") +
        "</div>"
      );
    }
    if (routed.handoff && routed.handoff.ausweis) {
      return (
        '<div class="primary-cta-slot">' +
        renderCta("ausweis", "primary", "cta.ausweis", "button") +
        "</div>"
      );
    }
    return "";
  }

  function scenarioById(routed, id) {
    if (!routed.scenarios) return null;
    for (var i = 0; i < routed.scenarios.length; i++) {
      if (routed.scenarios[i].id === id) return routed.scenarios[i];
    }
    return null;
  }

  function cashLine(sc) {
    if (!sc || !sc.mehrAfa || sc.mehrAfa.ratesOnly) return "";
    var parts = [t("label.mehrAfa") + ": " + formatEuro(sc.mehrAfa.mehrAfaEur)];
    if (sc.steuerCash && !sc.steuerCash.ratesOnly) {
      parts.push(t("label.steuerCash") + ": " + formatEuro(sc.steuerCash.eurJahr));
    }
    if (sc.amort && !sc.amort.ratesOnly) {
      parts.push(
        t("label.amort") + ": " + formatNum(sc.amort.jahre, 1) + " (Modellrechnung)"
      );
    }
    return parts.join(" · ");
  }

  function renderFooter() {
    var name = t("product.name");
    document.title = name;
    var version = state.ruleset ? state.ruleset.version : "—";
    var stand = state.ruleset ? state.ruleset.stand : "—";
    $("footer-meta").textContent =
      name + " · " + version + " · " + stand + " · " + t("footer.disclaimer");
    $("footer-disclaimer").textContent = t("footer.disclaimer");
    $("rechtslage-body").textContent = t("rnd.rechtslage");
    $("impressum-body").innerHTML =
      escapeHtml(t("impressum.betreiber")) +
      "<br>" +
      escapeHtml(t("impressum.anschrift")) +
      "<br>" +
      escapeHtml(t("impressum.kontakt")) +
      "<br>" +
      escapeHtml(t("impressum.ustId")) +
      "<br>" +
      escapeHtml(t("impressum.verantwortlich"));
    $("datenschutz-body").innerHTML =
      "<p>" +
      escapeHtml(t("datenschutz.keinObjektbezug")) +
      "</p><p>" +
      escapeHtml(t("datenschutz.hosterHinweis")) +
      "</p><p>" +
      escapeHtml(t("legal.keineSteuerberatung")) +
      "</p>";
    // Localize static legends after copy load
    var gLeg = $("annahme-grenz-legend");
    if (gLeg) gLeg.textContent = t("annahme.grenzsatz");
    var gHint = $("annahme-grenz-hint");
    if (gHint) gHint.textContent = t("annahme.grenzsatzHint");
    var hLeg = $("annahme-honorar-legend");
    if (hLeg) hLeg.textContent = t("annahme.honorar");
    var hHint = $("annahme-honorar-hint");
    if (hHint) hHint.textContent = t("annahme.honorarHint");
    var kLeg = $("kpa-compare-legend");
    if (kLeg) kLeg.textContent = t("kpa.compareTitle");
    var kHint = $("kpa-compare-hint");
    if (kHint) kHint.textContent = t("kpa.compareHint");
    var presets = document.querySelectorAll("[data-set-grenz]");
    for (var i = 0; i < presets.length; i++) {
      var pct = presets[i].getAttribute("data-set-grenz");
      presets[i].textContent = t("annahme.presetGrenz").split("{pct}").join(pct);
    }
    var hPreset = document.querySelector("[data-set-honorar]");
    if (hPreset) hPreset.textContent = t("annahme.presetHonorar");
    NC.skin.apply(state.skin, t);
  }

  function tileShell(id, title, collapsedHtml, bodyHtml, expanded) {
    return (
      '<article class="tile" data-tile="' +
      escapeHtml(id) +
      '" data-expanded="' +
      (expanded ? "true" : "false") +
      '">' +
      '<button type="button" class="tile-summary" data-expand="' +
      escapeHtml(id) +
      '">' +
      "<h2>" +
      escapeHtml(title) +
      "</h2>" +
      '<p class="tile-collapsed-line">' +
      collapsedHtml +
      "</p>" +
      "</button>" +
      '<div class="tile-body">' +
      bodyHtml +
      "</div>" +
      "</article>"
    );
  }

  function renderAfaBody(routed, facts) {
    var html = '<p class="modell">Modellrechnung</p>';
    if (routed.afa && routed.afa.blocked) {
      html +=
        "<p>Ohne Fertigstellungsjahr keine gesetzliche Satz-Zuordnung. Es wird kein Satz erfunden.</p>";
    } else if (routed.afa) {
      html +=
        "<p>Gesetzlicher Satz: <strong>" +
        escapeHtml(formatPct(routed.afa.satzPct)) +
        "</strong> (gesetzliche ND-Größe: " +
        escapeHtml(String(routed.afa.gesetzlicheNdJahre)) +
        " Jahre).</p>";
      if (facts.nutzung === "nichtwohnen" || facts.nutzung === "gemischt") {
        html +=
          '<p class="note">' + escapeHtml(t("afa.nichtwohnenHinweis")) + "</p>";
      }
      html += '<p class="note">' + escapeHtml(t("deg5a.outOfScope")) + "</p>";
    }
    return html;
  }

  function renderRndBody(routed) {
    var html = '<p class="modell">Modellrechnung</p>';
    if (routed.rndPosture === "suppress") {
      html +=
        '<p class="note note-strong">' +
        escapeHtml(t("rnd.unwirtschaftlich")) +
        "</p>";
    } else if (routed.rndPosture === "widen") {
      html += '<p class="note">' + escapeHtml(t("rnd.widenNote")) + "</p>";
    }

    var showTax = routed.grenzsatzPct != null;
    var showAmort = routed.honorarEur != null && showTax;

    if (routed.scenarios && routed.scenarios.length) {
      html +=
        '<table class="scenarios"><thead><tr>' +
        "<th>Szenario</th><th>Satz</th>";
      if (routed.gebaeudeanteilEur != null) {
        html += "<th>" + escapeHtml(t("label.mehrAfa")) + "</th>";
      }
      if (showTax) html += "<th>" + escapeHtml(t("label.steuerCash")) + "</th>";
      if (showAmort) html += "<th>" + escapeHtml(t("label.amort")) + "</th>";
      html += "</tr></thead><tbody>";
      for (var i = 0; i < routed.scenarios.length; i++) {
        var sc = routed.scenarios[i];
        var szenSatz = sc.ndJahre ? 100 / sc.ndJahre : null;
        html +=
          "<tr><td>" +
          escapeHtml(sc.label) +
          "</td><td>" +
          escapeHtml(formatPct(Math.round(szenSatz * 1000) / 1000)) +
          "</td>";
        if (routed.gebaeudeanteilEur != null) {
          if (sc.mehrAfa && !sc.mehrAfa.ratesOnly) {
            html +=
              '<td class="euro">' +
              escapeHtml(formatEuro(sc.mehrAfa.mehrAfaEur)) +
              "</td>";
          } else html += "<td>—</td>";
        }
        if (showTax) {
          if (sc.steuerCash && !sc.steuerCash.ratesOnly) {
            html +=
              '<td class="euro">' +
              escapeHtml(formatEuro(sc.steuerCash.eurJahr)) +
              "</td>";
          } else html += "<td>—</td>";
        }
        if (showAmort) {
          if (sc.amort && !sc.amort.ratesOnly) {
            html +=
              "<td>" +
              escapeHtml(formatNum(sc.amort.jahre, 1)) +
              " (Modellrechnung)</td>";
          } else html += "<td>—</td>";
        }
        html += "</tr>";
      }
      html += "</tbody></table>";
    }

    html +=
      '<details class="rechtslage-box"><summary>Rechtslage</summary><p>' +
      escapeHtml(t("rnd.rechtslage")) +
      "</p></details>";

    if (routed.rndCta && routed.rndCta.secondaryText) {
      html += renderCta("rnd", "secondary", "cta.rndSecondary", "text");
    }
    return html;
  }

  function renderKpaBody(routed) {
    var html =
      '<p class="modell">Modellrechnung</p><p>' +
      escapeHtml(t("kpa.arbeitshilfeVsGutachten")) +
      "</p>";
    if (routed.kpaCompare) {
      html +=
        "<p><strong>" +
        escapeHtml(t("kpa.compareTitle")) +
        "</strong></p><ul>" +
        "<li>A: " +
        escapeHtml(formatPct(routed.kpaCompare.a.splitPct)) +
        " → " +
        escapeHtml(formatEuro(routed.kpaCompare.a.gebaeudeanteilEur)) +
        " · AfA gesetzlich " +
        escapeHtml(formatEuro(routed.kpaCompare.a.afaGesetzlichEur)) +
        "</li>" +
        "<li>B: " +
        escapeHtml(formatPct(routed.kpaCompare.b.splitPct)) +
        " → " +
        escapeHtml(formatEuro(routed.kpaCompare.b.gebaeudeanteilEur)) +
        " · AfA gesetzlich " +
        escapeHtml(formatEuro(routed.kpaCompare.b.afaGesetzlichEur)) +
        "</li></ul>";
    }
    return html;
  }

  function renderAusweisBody(routed) {
    var key = "geg.keinAnlass";
    if (routed.geg === "pflicht_orientierung") key = "geg.pflicht";
    else if (routed.geg === "ausnahme_pruefen") key = "geg.ausnahme";
    else if (routed.geg === "vorhanden") key = "geg.vorhanden";
    return "<p>" + escapeHtml(t(key)) + "</p>";
  }

  function defaultExpanded(routed) {
    if (routed.cards.rnd) return "rnd";
    if (routed.cards.afa) return "afa";
    if (routed.cards.kpa) return "kpa";
    if (routed.cards.ausweis) return "ausweis";
    return "rnd";
  }

  function renderResults() {
    if (!state.ready) return;
    var facts = readFacts();
    var routed = NC.route(facts, state.ruleset);
    var box = $("results");

    if (!state.expanded || !routed.cards[state.expanded]) {
      state.expanded = defaultExpanded(routed);
    }

    var html = "";
    if (routed.cards.afa) {
      var afaCollapsed =
        routed.afa && !routed.afa.blocked
          ? escapeHtml(formatPct(routed.afa.satzPct))
          : "—";
      html += tileShell(
        "afa",
        t("tile.afa"),
        afaCollapsed,
        renderAfaBody(routed, facts),
        state.expanded === "afa"
      );
    }
    if (routed.cards.rnd) {
      var nd30 = scenarioById(routed, "nd30");
      var postureLabel = routed.rndPosture;
      var collapsed =
        escapeHtml(postureLabel) +
        (cashLine(nd30) ? " · " + escapeHtml(cashLine(nd30)) : "");
      if (routed.rndPosture === "suppress") {
        collapsed =
          escapeHtml(t("rnd.unwirtschaftlich")) +
          " · " +
          escapeHtml(postureLabel);
      }
      html += tileShell(
        "rnd",
        t("tile.rnd"),
        collapsed,
        renderRndBody(routed),
        state.expanded === "rnd"
      );
    }
    if (routed.cards.kpa) {
      html += tileShell(
        "kpa",
        t("tile.kpa"),
        escapeHtml(t("kpa.arbeitshilfeVsGutachten")).slice(0, 80) + "…",
        renderKpaBody(routed),
        state.expanded === "kpa"
      );
    }
    if (routed.cards.ausweis) {
      var aKey = "geg.keinAnlass";
      if (routed.geg === "pflicht_orientierung") aKey = "geg.pflicht";
      else if (routed.geg === "ausnahme_pruefen") aKey = "geg.ausnahme";
      else if (routed.geg === "vorhanden") aKey = "geg.vorhanden";
      html += tileShell(
        "ausweis",
        t("tile.ausweis"),
        escapeHtml(t(aKey)).slice(0, 80) + "…",
        renderAusweisBody(routed),
        state.expanded === "ausweis"
      );
    }

    html += renderPrimaryCta(routed);

    if (!html) {
      html =
        '<p class="note">Mit den aktuellen Angaben werden keine Ergebnis-Karten angezeigt.</p>';
    }

    box.innerHTML = html;
    if (isDesktop() || state.step >= 2) box.hidden = false;
    else box.hidden = true;

    var forbidden = [
      "Ihre Restnutzungsdauer",
      "Anerkennungsquote",
      "Steuerspar-Garantie",
    ];
    var text = box.innerText || "";
    for (var i = 0; i < forbidden.length; i++) {
      if (text.indexOf(forbidden[i]) !== -1) {
        console.error("Forbidden string in results:", forbidden[i]);
      }
    }
  }

  function bindUi() {
    var form = $("gate-form");
    form.addEventListener("input", renderResults);
    form.addEventListener("change", function () {
      var wrap = $("mod-jahr-wrap");
      if (wrap) {
        wrap.hidden = radioValue("modernisierung") !== "umfassend";
      }
      renderResults();
    });

    document.getElementById("step-nav").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-step]");
      if (!btn) return;
      setStep(Number(btn.getAttribute("data-step")));
      renderResults();
    });
    $("step-prev").addEventListener("click", function () {
      setStep(state.step - 1);
      renderResults();
    });
    $("step-next").addEventListener("click", function () {
      setStep(state.step + 1);
      renderResults();
    });

    $("results").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-expand]");
      if (!btn) return;
      state.expanded = btn.getAttribute("data-expand");
      renderResults();
    });

    form.addEventListener("click", function (e) {
      var g = e.target.closest("[data-set-grenz]");
      if (g) {
        $("grenzsatzPct").value = g.getAttribute("data-set-grenz");
        renderResults();
        return;
      }
      var h = e.target.closest("[data-set-honorar]");
      if (h) {
        $("honorarEur").value = h.getAttribute("data-set-honorar");
        renderResults();
      }
    });

    window.addEventListener("resize", function () {
      setStep(state.step);
    });
  }

  function loadJson(path) {
    return fetch(path, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status + " for " + path);
      return res.json();
    });
  }

  function loadRuleset() {
    if (window.__NC_RULESET__) return Promise.resolve(window.__NC_RULESET__);
    return loadJson("rulesets/current.json");
  }

  function loadCopy() {
    if (window.__NC_COPY__) return Promise.resolve(window.__NC_COPY__);
    return loadJson("config/copy.de.json");
  }

  function boot() {
    Promise.all([
      loadRuleset(),
      loadCopy(),
      NC.affiliates.load(loadJson),
      NC.skin.resolve(loadJson),
    ])
      .then(function (pair) {
        state.ruleset = pair[0];
        state.copy = pair[1];
        state.skin = pair[3] || {};
        state.ready = true;
        renderFooter();
        bindUi();
        setStep(1);
        var wrap = $("mod-jahr-wrap");
        if (wrap) wrap.hidden = radioValue("modernisierung") !== "umfassend";
        renderResults();
      })
      .catch(function () {
        showBanner(
          "Ruleset/Copy/Affiliates konnte nicht geladen werden (z. B. file://). Bitte über http://localhost öffnen oder die gepackte HTML-Datei nutzen. Es werden keine AfA-Sätze erfunden."
        );
        state.ready = false;
        $("results").hidden = true;
        $("footer-meta").textContent = "Nachweischeck · Ruleset nicht geladen";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
