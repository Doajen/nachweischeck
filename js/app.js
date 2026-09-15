/**
 * Role-guided SPA. No persist, no analytics.
 * Avoids jargon: Anlass, Nutzung, primary/widen/suppress, gesetzliche ND-Größe.
 */
(function () {
  "use strict";

  var state = {
    ruleset: null,
    copy: null,
    skin: {},
    ready: false,
    expanded: "rnd",
    phase: "role", // role | buy | object
  };

  var ROLE_LABEL = {
    vermieter: "Ich vermiete schon",
    kaeufer_vermiet: "Ich kaufe zum Vermieten",
    kaeufer_eigen: "Ich kaufe zum Selbstwohnen",
    verkaeufer: "Ich verkaufe",
    mieter: "Ich bin Mieter",
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

  function syncHiddenFromRolle(rolle) {
    $("rolle").value = rolle || "";
    var mapped = NC.applyRolle({
      rolle: rolle,
      anlass:
        rolle === "vermieter"
          ? radioValue("vermieter_anlass") || "halten"
          : undefined,
    });
    $("anlass").value = mapped.anlass || "";
    $("nutzung").value = mapped.nutzung || "";
  }

  function readFacts() {
    var rolle = $("rolle").value || null;
    if (rolle === "vermieter") {
      syncHiddenFromRolle("vermieter");
    }
    var facts = {
      rolle: rolle || undefined,
      anlass: $("anlass").value || undefined,
      nutzung: $("nutzung").value || undefined,
      fertigstellungJahr: optionalNumber("fertigstellungJahr"),
      modernisierung: radioValue("modernisierung") || "unbekannt",
      modernisierungJahr: optionalNumber("modernisierungJahr"),
      ausweis: radioValue("ausweis") || "unbekannt",
    };
    if (!facts.rolle) delete facts.rolle;
    if (!facts.anlass) delete facts.anlass;
    if (!facts.nutzung) delete facts.nutzung;

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

  function postureLabel(posture) {
    if (posture === "primary") return t("posture.pruefen");
    if (posture === "widen") return t("posture.unsicher");
    if (posture === "suppress") return t("posture.unwirtschaftlich");
    return "";
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

  function updateModJahrVisibility() {
    var wrap = $("mod-jahr-wrap");
    if (!wrap) return;
    wrap.hidden = radioValue("modernisierung") !== "umfassend";
  }

  function setPhase(phase) {
    state.phase = phase;
    $("screen-role").hidden = phase === "object";
    $("buy-split").hidden = phase !== "buy";
    $("role-grid").hidden = phase === "buy" || phase === "object";
    $("screen-object").hidden = phase !== "object";
    if (phase === "object") {
      var rolle = $("rolle").value;
      $("role-badge").textContent =
        t("role.badgePrefix") + " " + (t("role." + rolle) || ROLE_LABEL[rolle] || "");
      $("vermieter-anlass-block").hidden = rolle !== "vermieter";
      updateModJahrVisibility();
    }
  }

  function selectRole(rolle) {
    syncHiddenFromRolle(rolle);
    setPhase("object");
    renderResults();
  }

  function shouldShowDashboard(facts) {
    if (!facts.rolle) return false;
    if (
      facts.rolle === "mieter" ||
      facts.rolle === "verkaeufer" ||
      facts.rolle === "kaeufer_eigen"
    ) {
      return true;
    }
    return Number.isFinite(facts.fertigstellungJahr);
  }

  function renderCta(lever, slot, labelKey, variant) {
    var url = NC.affiliates.buildUrl(lever, slot);
    var vendor = NC.affiliates.vendorName(lever, slot);
    if (!url) return "";
    var cls = variant === "text" ? "cta cta-text" : "cta cta-button";
    return (
      '<div class="' +
      cls +
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
      escapeHtml(t(labelKey)) +
      "</a>" +
      '<p class="cta-print-only">' +
      escapeHtml(vendor) +
      " — " +
      escapeHtml(t("cta.werbung")) +
      "</p>" +
      "</div>"
    );
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
    $("zahlen-summary").textContent = t("zahlen.summary");
    $("buy-split-hint").textContent = t("role.buyHint");
    var gHint = $("annahme-grenz-hint");
    if (gHint) gHint.textContent = t("annahme.grenzsatzHint");
    var hHint = $("annahme-honorar-hint");
    if (hHint) hHint.textContent = t("annahme.honorarHint");
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

  function renderAfaBody(routed) {
    var html = '<p class="modell">Modellrechnung</p>';
    if (routed.afa && routed.afa.blocked) {
      html += "<p>" + escapeHtml(t("afa.needYear")) + "</p>";
    } else if (routed.afa) {
      html +=
        "<p>" +
        escapeHtml(t("afa.satzLabel")) +
        ": <strong>" +
        escapeHtml(formatPct(routed.afa.satzPct)) +
        "</strong> " +
        escapeHtml(t("afa.perYear")) +
        ".</p>";
      html += '<p class="note">' + escapeHtml(t("deg5a.outOfScope")) + "</p>";
    }
    return html;
  }

  function renderRndBody(routed) {
    var html = '<p class="modell">Modellrechnung</p>';
    html +=
      '<p class="note note-strong">' +
      escapeHtml(postureLabel(routed.rndPosture)) +
      "</p>";
    if (routed.rndPosture === "suppress") {
      html += '<p class="note">' + escapeHtml(t("rnd.unwirtschaftlich")) + "</p>";
    } else if (routed.rndPosture === "widen") {
      html += '<p class="note">' + escapeHtml(t("rnd.widenNote")) + "</p>";
    }

    var showTax = routed.grenzsatzPct != null;
    var showAmort = routed.honorarEur != null && showTax;

    if (routed.scenarios && routed.scenarios.length) {
      html +=
        '<table class="scenarios"><thead><tr><th>Szenario</th><th>Satz</th>';
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
          html +=
            sc.mehrAfa && !sc.mehrAfa.ratesOnly
              ? '<td class="euro">' +
                escapeHtml(formatEuro(sc.mehrAfa.mehrAfaEur)) +
                "</td>"
              : "<td>—</td>";
        }
        if (showTax) {
          html +=
            sc.steuerCash && !sc.steuerCash.ratesOnly
              ? '<td class="euro">' +
                escapeHtml(formatEuro(sc.steuerCash.eurJahr)) +
                "</td>"
              : "<td>—</td>";
        }
        if (showAmort) {
          html +=
            sc.amort && !sc.amort.ratesOnly
              ? "<td>" +
                escapeHtml(formatNum(sc.amort.jahre, 1)) +
                " (Modellrechnung)</td>"
              : "<td>—</td>";
        }
        html += "</tr>";
      }
      html += "</tbody></table>";
    }

    html +=
      '<details class="rechtslage-box"><summary>Hintergrund</summary><p>' +
      escapeHtml(t("rnd.rechtslage")) +
      "</p></details>";

    if (routed.rndCta && routed.rndCta.primary) {
      html += renderCta("rnd", "primary", "cta.rndPrimary", "button");
    } else if (routed.rndCta && routed.rndCta.secondaryText) {
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
        "<ul><li>A: " +
        escapeHtml(formatPct(routed.kpaCompare.a.splitPct)) +
        " → " +
        escapeHtml(formatEuro(routed.kpaCompare.a.gebaeudeanteilEur)) +
        "</li><li>B: " +
        escapeHtml(formatPct(routed.kpaCompare.b.splitPct)) +
        " → " +
        escapeHtml(formatEuro(routed.kpaCompare.b.gebaeudeanteilEur)) +
        "</li></ul>";
    }
    if (routed.handoff && routed.handoff.kpa) {
      html += renderCta("kpa", "primary", "cta.kpa", "button");
    }
    return html;
  }

  function renderAusweisBody(routed) {
    var key = "geg.keinAnlass";
    if (routed.rolle === "mieter") key = "mieter.ausweisOnly";
    else if (routed.geg === "pflicht_orientierung") key = "geg.pflicht";
    else if (routed.geg === "ausnahme_pruefen") key = "geg.ausnahme";
    else if (routed.geg === "vorhanden") key = "geg.vorhanden";
    var html = "<p>" + escapeHtml(t(key)) + "</p>";
    if (routed.rolle === "mieter") {
      html += '<p class="note">' + escapeHtml(t("mieter.forward")) + "</p>";
    }
    if (routed.handoff && routed.handoff.ausweis) {
      html += renderCta("ausweis", "primary", "cta.ausweis", "button");
    }
    return html;
  }

  function defaultExpanded(routed) {
    if (routed.cards.rnd) return "rnd";
    if (routed.cards.ausweis) return "ausweis";
    if (routed.cards.afa) return "afa";
    if (routed.cards.kpa) return "kpa";
    return "ausweis";
  }

  function renderResults() {
    if (!state.ready) return;
    var facts = readFacts();
    var box = $("results");

    if (!shouldShowDashboard(facts)) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }

    var routed = NC.route(facts, state.ruleset);
    if (!state.expanded || !routed.cards[state.expanded]) {
      state.expanded = defaultExpanded(routed);
    }

    var html = "";
    if (routed.cards.afa) {
      var afaCollapsed =
        routed.afa && !routed.afa.blocked
          ? escapeHtml(formatPct(routed.afa.satzPct)) + " " + escapeHtml(t("afa.perYear"))
          : "—";
      html += tileShell(
        "afa",
        t("tile.afa"),
        afaCollapsed,
        renderAfaBody(routed),
        state.expanded === "afa"
      );
    }
    if (routed.cards.rnd) {
      var nd30 = scenarioById(routed, "nd30");
      var collapsed =
        escapeHtml(postureLabel(routed.rndPosture)) +
        (cashLine(nd30) ? " · " + escapeHtml(cashLine(nd30)) : "");
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
        escapeHtml(t("kpa.arbeitshilfeVsGutachten")).slice(0, 72) + "…",
        renderKpaBody(routed),
        state.expanded === "kpa"
      );
    }
    if (routed.cards.ausweis) {
      var aKey =
        routed.rolle === "mieter" ? "mieter.ausweisOnly" : "geg.pflicht";
      if (routed.rolle !== "mieter") {
        if (routed.geg === "ausnahme_pruefen") aKey = "geg.ausnahme";
        else if (routed.geg === "vorhanden") aKey = "geg.vorhanden";
        else if (routed.geg === "kein_anlass") aKey = "geg.keinAnlass";
      }
      html += tileShell(
        "ausweis",
        t("tile.ausweis"),
        escapeHtml(t(aKey)).slice(0, 72) + "…",
        renderAusweisBody(routed),
        state.expanded === "ausweis"
      );
    }

    if (!html) {
      html = '<p class="note">' + escapeHtml(t("dashboard.empty")) + "</p>";
    }

    box.innerHTML = html;
    box.hidden = false;

    var forbidden = [
      "Ihre Restnutzungsdauer",
      "Anerkennungsquote",
      "Steuerspar-Garantie",
      "gesetzliche ND-Größe",
      "primary",
      "widen",
      "suppress",
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
    form.addEventListener("input", function () {
      updateModJahrVisibility();
      renderResults();
    });
    form.addEventListener("change", function () {
      updateModJahrVisibility();
      if ($("rolle").value === "vermieter") syncHiddenFromRolle("vermieter");
      renderResults();
    });

    $("role-grid").addEventListener("click", function (e) {
      var btn = e.target.closest(".choice");
      if (!btn) return;
      if (btn.getAttribute("data-role-group") === "kaufen") {
        setPhase("buy");
        return;
      }
      var rolle = btn.getAttribute("data-role");
      if (rolle) selectRole(rolle);
    });

    $("buy-split").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-role]");
      if (btn) selectRole(btn.getAttribute("data-role"));
    });
    $("buy-back").addEventListener("click", function () {
      setPhase("role");
      $("rolle").value = "";
      renderResults();
    });
    $("role-back").addEventListener("click", function () {
      $("rolle").value = "";
      $("anlass").value = "";
      $("nutzung").value = "";
      setPhase("role");
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

    updateModJahrVisibility();
  }

  function loadJson(path) {
    return fetch(path, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status + " for " + path);
      return res.json();
    });
  }

  function boot() {
    Promise.all([
      window.__NC_RULESET__
        ? Promise.resolve(window.__NC_RULESET__)
        : loadJson("rulesets/current.json"),
      window.__NC_COPY__
        ? Promise.resolve(window.__NC_COPY__)
        : loadJson("config/copy.de.json"),
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
        setPhase("role");
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
