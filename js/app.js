/**
 * Educational quadrants + glossary. Calc/route/affiliates unchanged.
 */
(function () {
  "use strict";

  var state = {
    ruleset: null,
    copy: null,
    skin: {},
    ready: false,
    expanded: "rnd",
    buyOpen: false,
  };

  var AFAC_PATHS = { vermieter: true, kaeufer_vermiet: true };
  var AUSWEIS_PATHS = { mieter: true, kaeufer_eigen: true, verkaeufer: true };

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

  function yearKnown(facts) {
    return Number.isFinite(facts.fertigstellungJahr);
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
    if (rolle === "vermieter") syncHiddenFromRolle("vermieter");
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
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);
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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showBanner(msg) {
    $("load-banner").hidden = false;
    $("load-banner").textContent = msg;
  }

  function setQuadOpen(id, open) {
    var el = $(id);
    if (!el) return;
    el.setAttribute("data-open", open ? "true" : "false");
  }

  function termBtn(term, label) {
    return (
      '<button type="button" class="term-help" data-term="' +
      escapeHtml(term) +
      '" aria-label="Hilfe ' +
      escapeHtml(label || term) +
      '">?</button>'
    );
  }

  function updateModJahrVisibility() {
    var wrap = $("mod-jahr-wrap");
    if (wrap) wrap.hidden = radioValue("modernisierung") !== "umfassend";
  }

  function unlock(facts) {
    var rolle = facts.rolle;

    setQuadOpen("q1-role", true);

    if (!rolle) {
      setQuadOpen("q2-context", false);
      setQuadOpen("q3-insight", false);
      setQuadOpen("q4-next", false);
      $("q2-body").hidden = true;
      $("q3-body").hidden = true;
      $("q4-body").hidden = true;
      $("buy-split").hidden = !state.buyOpen;
      $("role-grid").hidden = state.buyOpen;
      return { path: null, showInsight: false };
    }

    $("buy-split").hidden = true;
    $("role-grid").hidden = false;
    setQuadOpen("q2-context", true);
    $("q2-body").hidden = false;

    var afaPath = !!AFAC_PATHS[rolle];
    var ausweisPath = !!AUSWEIS_PATHS[rolle];

    $("q2-object-fields").hidden = !afaPath;
    $("q2-edu").hidden = !ausweisPath;
    $("year-field").hidden = !afaPath;
    $("mod-group").hidden = !afaPath;
    $("vermieter-anlass-block").hidden = rolle !== "vermieter";
    $("q4-zahlen").hidden = !afaPath;
    $("ausweis-block").hidden = false;

    if (ausweisPath) {
      $("q2-edu-text").textContent =
        rolle === "mieter"
          ? t("mieter.ausweisOnly") + " " + t("mieter.forward")
          : t("edu.ausweisPath");
    }

    $("role-badge").textContent =
      t("role.badgePrefix") + " " + (t("role." + rolle) || rolle);

    updateModJahrVisibility();

    var showInsight = false;
    if (ausweisPath) {
      showInsight = true;
    } else if (afaPath && yearKnown(facts)) {
      showInsight = true;
    }

    setQuadOpen("q3-insight", showInsight);
    setQuadOpen("q4-next", showInsight);
    $("q3-body").hidden = !showInsight;
    $("q4-body").hidden = !showInsight;

    return { path: afaPath ? "afa" : "ausweis", showInsight: showInsight };
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

  function renderLagebild(routed) {
    if (!routed.afa || routed.afa.blocked) return "";
    var beat1 = t("lagebild.beat1")
      .split("{satzPct}")
      .join(String(routed.afa.satzPct).replace(".", ","))
      .split("{ndJahre}")
      .join(String(routed.afa.gesetzlicheNdJahre));
    var postureBodyKey = "posture.body.pruefen";
    if (routed.rndPosture === "widen") postureBodyKey = "posture.body.unsicher";
    if (routed.rndPosture === "suppress") postureBodyKey = "posture.body.unwirtschaftlich";
    return (
      '<section class="lagebild" id="lagebild">' +
      "<h2>" +
      escapeHtml(t("lagebild.title")) +
      " " +
      termBtn("afa", "AfA") +
      " " +
      termBtn("rnd", "RND") +
      "</h2>" +
      '<p class="modell-caption">' +
      escapeHtml(t("modell.caption")) +
      "</p>" +
      "<p>" +
      escapeHtml(beat1) +
      " " +
      termBtn("gesetzliche_groesse", "gesetzliche Größe") +
      "</p>" +
      "<p>" +
      escapeHtml(t("lagebild.beat2")) +
      " " +
      termBtn("nachweis", "Nachweis") +
      "</p>" +
      "<p>" +
      escapeHtml(t("lagebild.beat3")) +
      " " +
      termBtn("szenario_nd", "Szenario ND") +
      "</p>" +
      "<p>" +
      escapeHtml(t("lagebild.beat4")) +
      "</p>" +
      '<p class="posture"><strong>' +
      escapeHtml(t("posture.lead")) +
      ": " +
      escapeHtml(postureLabel(routed.rndPosture)) +
      "</strong> " +
      escapeHtml(t(postureBodyKey)) +
      "</p>" +
      "</section>"
    );
  }

  function scenarioById(routed, id) {
    if (!routed.scenarios) return null;
    for (var i = 0; i < routed.scenarios.length; i++) {
      if (routed.scenarios[i].id === id) return routed.scenarios[i];
    }
    return null;
  }

  function tileShell(id, title, collapsed, body, expanded) {
    return (
      '<article class="tile" data-tile="' +
      escapeHtml(id) +
      '" data-expanded="' +
      (expanded ? "true" : "false") +
      '">' +
      '<button type="button" class="tile-summary" data-expand="' +
      escapeHtml(id) +
      '"><h2>' +
      escapeHtml(title) +
      "</h2><p class=\"tile-collapsed-line\">" +
      collapsed +
      "</p></button>" +
      '<div class="tile-body">' +
      body +
      "</div></article>"
    );
  }

  function renderRndBody(routed) {
    var html = "";
    if (routed.rndPosture === "suppress") {
      html += "<p class=\"note\">" + escapeHtml(t("rnd.unwirtschaftlich")) + "</p>";
    } else if (routed.rndPosture === "widen") {
      html += "<p class=\"note\">" + escapeHtml(t("rnd.widenNote")) + "</p>";
    }

    var showTax = routed.grenzsatzPct != null;
    var showAmort = routed.honorarEur != null && showTax;
    if (routed.scenarios && routed.scenarios.length) {
      html +=
        '<table class="scenarios"><thead><tr><th>' +
        escapeHtml(t("table.szenario")) +
        "</th><th>" +
        escapeHtml(t("table.satz")) +
        "</th>";
      if (routed.gebaeudeanteilEur != null) html += "<th>" + escapeHtml(t("label.mehrAfa")) + "</th>";
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
              ? '<td class="euro">' + escapeHtml(formatEuro(sc.mehrAfa.mehrAfaEur)) + "</td>"
              : "<td>—</td>";
        }
        if (showTax) {
          html +=
            sc.steuerCash && !sc.steuerCash.ratesOnly
              ? '<td class="euro">' + escapeHtml(formatEuro(sc.steuerCash.eurJahr)) + "</td>"
              : "<td>—</td>";
        }
        if (showAmort) {
          html +=
            sc.amort && !sc.amort.ratesOnly
              ? "<td>" + escapeHtml(formatNum(sc.amort.jahre, 1)) + "</td>"
              : "<td>—</td>";
        }
        html += "</tr>";
      }
      html += "</tbody></table>";
      html +=
        '<p class="modell-caption">' + escapeHtml(t("modell.caption")) + "</p>";
    }

    html +=
      '<details class="rechtslage-box"><summary>' +
      escapeHtml(t("details.hintergrund")) +
      "</summary><p>" +
      escapeHtml(t("rnd.rechtslage")) +
      "</p></details>";

    if (routed.rndCta && routed.rndCta.primary) {
      html += renderCta("rnd", "primary", "cta.rndPrimary", "button");
    } else if (routed.rndCta && routed.rndCta.secondaryText) {
      html += renderCta("rnd", "secondary", "cta.rndSecondary", "text");
    }
    return html;
  }

  function renderAfaBody(routed) {
    if (routed.afa && routed.afa.blocked) {
      return "<p>" + escapeHtml(t("afa.needYear")) + "</p>";
    }
    return (
      "<p>" +
      escapeHtml(t("afa.satzLabel")) +
      ": <strong>" +
      escapeHtml(formatPct(routed.afa.satzPct)) +
      "</strong> " +
      escapeHtml(t("afa.perYear")) +
      ".</p><p class=\"note\">" +
      escapeHtml(t("deg5a.outOfScope")) +
      "</p>"
    );
  }

  function renderKpaBody(routed) {
    var html =
      "<p>" +
      escapeHtml(t("kpa.arbeitshilfeVsGutachten")) +
      " " +
      termBtn("arbeitshilfe", "Arbeitshilfe") +
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
      html += "<p class=\"note\">" + escapeHtml(t("mieter.forward")) + "</p>";
    }
    if (routed.handoff && routed.handoff.ausweis) {
      html += renderCta("ausweis", "primary", "cta.ausweis", "button");
    }
    return html;
  }

  function strongestCta(routed) {
    if (routed.rndCta && routed.rndCta.primary) {
      return renderCta("rnd", "primary", "cta.rndPrimary", "button");
    }
    if (routed.handoff && routed.handoff.kpa) {
      return renderCta("kpa", "primary", "cta.kpa", "button");
    }
    if (routed.handoff && routed.handoff.ausweis) {
      return renderCta("ausweis", "primary", "cta.ausweis", "button");
    }
    if (routed.rndCta && routed.rndCta.secondaryText) {
      return renderCta("rnd", "secondary", "cta.rndSecondary", "text");
    }
    return "";
  }

  function defaultExpanded(routed) {
    if (routed.cards.rnd) return "rnd";
    if (routed.cards.ausweis) return "ausweis";
    if (routed.cards.afa) return "afa";
    if (routed.cards.kpa) return "kpa";
    return "ausweis";
  }

  function assertNoForbidden(text) {
    var forbidden = [
      "Ihre Restnutzungsdauer",
      "landet bei",
      "typischerweise 20–30",
      "Anerkennungsquote",
      "Steuerspar-Garantie",
      "gute Erfolgsaussicht",
      "Optimierung",
      "Garantierte",
    ];
    for (var i = 0; i < forbidden.length; i++) {
      if (text.indexOf(forbidden[i]) !== -1) {
        console.error("Forbidden string:", forbidden[i]);
      }
    }
  }

  function renderAll() {
    if (!state.ready) return;
    var facts = readFacts();
    var unlockState = unlock(facts);

    if (!facts.rolle || !unlockState.showInsight) {
      $("q3-body").innerHTML = "";
      $("q4-body").innerHTML = "";
      return;
    }

    var routed = NC.route(facts, state.ruleset);
    if (!state.expanded || !routed.cards[state.expanded]) {
      state.expanded = defaultExpanded(routed);
    }

    var html = "";
    if (unlockState.path === "afa") {
      html += renderLagebild(routed);
    }

    html += '<div class="tiles">';
    if (routed.cards.afa) {
      html += tileShell(
        "afa",
        t("section.afa"),
        routed.afa && !routed.afa.blocked
          ? escapeHtml(formatPct(routed.afa.satzPct))
          : "—",
        renderAfaBody(routed),
        state.expanded === "afa"
      );
    }
    if (routed.cards.rnd) {
      var nd30 = scenarioById(routed, "nd30");
      var cash = "";
      if (nd30 && nd30.mehrAfa && !nd30.mehrAfa.ratesOnly) {
        cash = " · " + escapeHtml(formatEuro(nd30.mehrAfa.mehrAfaEur));
      }
      html += tileShell(
        "rnd",
        t("section.rnd"),
        escapeHtml(postureLabel(routed.rndPosture)) + cash,
        renderRndBody(routed),
        state.expanded === "rnd"
      );
    }
    if (routed.cards.kpa) {
      html += tileShell(
        "kpa",
        t("section.kpa"),
        escapeHtml(t("kpa.arbeitshilfeVsGutachten")).slice(0, 64) + "…",
        renderKpaBody(routed),
        state.expanded === "kpa"
      );
    }
    if (routed.cards.ausweis) {
      var aKey = routed.rolle === "mieter" ? "mieter.ausweisOnly" : "geg.pflicht";
      if (routed.rolle !== "mieter") {
        if (routed.geg === "vorhanden") aKey = "geg.vorhanden";
        else if (routed.geg === "kein_anlass") aKey = "geg.keinAnlass";
        else if (routed.geg === "ausnahme_pruefen") aKey = "geg.ausnahme";
      }
      html += tileShell(
        "ausweis",
        t("section.ausweis"),
        escapeHtml(t(aKey)).slice(0, 64) + "…",
        renderAusweisBody(routed),
        state.expanded === "ausweis"
      );
    }
    html += "</div>";

    $("q3-body").innerHTML = html;
    $("q4-body").innerHTML =
      "<h2>" +
      escapeHtml(t("q4.title")) +
      "</h2>" +
      strongestCta(routed);

    assertNoForbidden(($("q3-body").innerText || "") + ($("q4-body").innerText || ""));
  }

  function hidePopover() {
    var pop = $("term-popover");
    pop.hidden = true;
    pop.textContent = "";
  }

  function showPopover(btn) {
    var term = btn.getAttribute("data-term");
    var key = "glossary." + term;
    var pop = $("term-popover");
    pop.textContent = t(key);
    pop.hidden = false;
    var rect = btn.getBoundingClientRect();
    var top = rect.bottom + window.scrollY + 6;
    var left = rect.left + window.scrollX;
    pop.style.top = top + "px";
    pop.style.left = Math.min(left, window.scrollX + window.innerWidth - 300) + "px";
  }

  function resetRole() {
    $("rolle").value = "";
    $("anlass").value = "";
    $("nutzung").value = "";
    $("fertigstellungJahr").value = "";
    $("modernisierungJahr").value = "";
    state.buyOpen = false;
    state.expanded = "rnd";
    hidePopover();
    renderAll();
  }

  function selectRole(rolle) {
    syncHiddenFromRolle(rolle);
    state.buyOpen = false;
    renderAll();
  }

  /** Fill every data-copy / data-copy-placeholder / data-copy-aria node from copy.de.json. */
  function applyCopyBindings() {
    var text = document.querySelectorAll("[data-copy]");
    for (var i = 0; i < text.length; i++) {
      text[i].textContent = t(text[i].getAttribute("data-copy"));
    }
    var ph = document.querySelectorAll("[data-copy-placeholder]");
    for (var j = 0; j < ph.length; j++) {
      ph[j].setAttribute(
        "placeholder",
        t(ph[j].getAttribute("data-copy-placeholder"))
      );
    }
    var aria = document.querySelectorAll("[data-copy-aria]");
    for (var k = 0; k < aria.length; k++) {
      aria[k].setAttribute("aria-label", t(aria[k].getAttribute("data-copy-aria")));
    }
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
    applyCopyBindings();
    var presets = document.querySelectorAll("[data-set-grenz]");
    for (var i = 0; i < presets.length; i++) {
      var pct = presets[i].getAttribute("data-set-grenz");
      presets[i].textContent = t("annahme.presetGrenz").split("{pct}").join(pct);
    }
    var hPreset = document.querySelector("[data-set-honorar]");
    if (hPreset) hPreset.textContent = t("annahme.presetHonorar");
    NC.skin.apply(state.skin, t);
  }

  function bindUi() {
    var form = $("gate-form");
    form.addEventListener("input", function () {
      updateModJahrVisibility();
      renderAll();
    });
    form.addEventListener("change", function () {
      updateModJahrVisibility();
      if ($("rolle").value === "vermieter") syncHiddenFromRolle("vermieter");
      renderAll();
    });

    $("role-grid").addEventListener("click", function (e) {
      var btn = e.target.closest(".choice");
      if (!btn) return;
      if (btn.getAttribute("data-role-group") === "kaufen") {
        state.buyOpen = true;
        $("buy-split").hidden = false;
        $("role-grid").hidden = true;
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
      state.buyOpen = false;
      $("buy-split").hidden = true;
      $("role-grid").hidden = false;
    });
    $("role-back").addEventListener("click", resetRole);

    document.addEventListener("click", function (e) {
      var help = e.target.closest(".term-help");
      if (help) {
        e.preventDefault();
        e.stopPropagation();
        showPopover(help);
        return;
      }
      if (!$("term-popover").hidden && !e.target.closest("#term-popover")) {
        hidePopover();
      }
      var expand = e.target.closest("[data-expand]");
      if (expand) {
        state.expanded = expand.getAttribute("data-expand");
        renderAll();
      }
      var g = e.target.closest("[data-set-grenz]");
      if (g) {
        $("grenzsatzPct").value = g.getAttribute("data-set-grenz");
        renderAll();
      }
      var h = e.target.closest("[data-set-honorar]");
      if (h) {
        $("honorarEur").value = h.getAttribute("data-set-honorar");
        renderAll();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hidePopover();
    });

    updateModJahrVisibility();
  }

  function boot() {
    Promise.all([
      window.__NC_RULESET__
        ? Promise.resolve(window.__NC_RULESET__)
        : fetch("rulesets/current.json").then(function (r) {
            if (!r.ok) throw new Error("ruleset");
            return r.json();
          }),
      window.__NC_COPY__
        ? Promise.resolve(window.__NC_COPY__)
        : fetch("config/copy.de.json").then(function (r) {
            if (!r.ok) throw new Error("copy");
            return r.json();
          }),
      NC.affiliates.load(function (path) {
        return fetch(path).then(function (r) {
          if (!r.ok) throw new Error(path);
          return r.json();
        });
      }),
      NC.skin.resolve(function (path) {
        return fetch(path).then(function (r) {
          if (!r.ok) throw new Error(path);
          return r.json();
        });
      }),
    ])
      .then(function (pair) {
        state.ruleset = pair[0];
        state.copy = pair[1];
        state.skin = pair[3] || {};
        state.ready = true;
        renderFooter();
        bindUi();
        renderAll();
      })
      .catch(function () {
        showBanner(
          "Ruleset/Copy/Affiliates konnte nicht geladen werden (z. B. file://). Bitte über http://localhost öffnen oder die gepackte HTML-Datei nutzen. Es werden keine AfA-Sätze erfunden."
        );
        state.ready = false;
        $("footer-meta").textContent = "Nachweischeck · Ruleset nicht geladen";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
