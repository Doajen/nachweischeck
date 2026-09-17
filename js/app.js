/**
 * Beat unlock machine + render. No math: calc/route/affiliates own that.
 * Phases on #main: start (Rolle only) | context (Q2 open) | insight (Q3/Q4 open).
 */
(function () {
  "use strict";

  var state = {
    ruleset: null,
    copy: null,
    skin: {},
    ready: false,
    buyOpen: false,
    printRestore: null,
  };

  var AFA_PATHS = { vermieter: true, kaeufer_vermiet: true };
  var AUSWEIS_PATHS = { mieter: true, kaeufer_eigen: true, verkaeufer: true };

  var FORBIDDEN = [
    "Ihre Restnutzungsdauer",
    "landet bei",
    "typischerweise 20–30",
    "Anerkennungsquote",
    "Steuerspar-Garantie",
    "gute Erfolgsaussicht",
    "Optimierung",
    "Garantierte",
  ];

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

  /** Finite integer year only; anything else keeps the later beats shut. */
  function yearKnown(facts) {
    var y = facts.fertigstellungJahr;
    return Number.isFinite(y) && y === Math.trunc(y);
  }

  function setHidden(id, hidden) {
    var el = $(id);
    if (el) el.hidden = !!hidden;
  }

  function setBeatOpen(id, open) {
    var el = $(id);
    if (el) el.setAttribute("data-open", open ? "true" : "false");
  }

  function closeDetails(id) {
    var el = $(id);
    if (el) el.open = false;
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

    // Strict boolean: a checkbox is checked or it is not. Never the string "true".
    var gutachten = $("gutachtenVorhanden");
    if (gutachten && gutachten.checked === true) {
      facts.gutachtenVorhanden = true;
    }

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

  function postureBodyKey(posture) {
    if (posture === "widen") return "posture.body.unsicher";
    if (posture === "suppress") return "posture.body.unwirtschaftlich";
    return "posture.body.pruefen";
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

  function termBtn(term, label) {
    return (
      '<button type="button" class="term-help" data-term="' +
      escapeHtml(term) +
      '" aria-label="' +
      escapeHtml(label || term) +
      '">?</button>'
    );
  }

  function para(text, cls) {
    return (
      '<p' + (cls ? ' class="' + cls + '"' : "") + ">" + escapeHtml(text) + "</p>"
    );
  }

  function updateModJahrVisibility() {
    setHidden("mod-jahr-wrap", radioValue("modernisierung") !== "umfassend");
  }

  /**
   * Decide which beats are open. Returns { path, phase, showInsight }.
   */
  function unlock(facts) {
    var rolle = facts.rolle || null;

    if (!rolle) {
      $("main").setAttribute("data-phase", "start");
      setBeatOpen("q1-role", true);
      setBeatOpen("q2-context", false);
      setBeatOpen("q3-insight", false);
      setBeatOpen("q4-next", false);
      setHidden("q2-body", true);
      setHidden("q3-body", true);
      setHidden("q4-body", true);
      setHidden("mod-group", true);
      setHidden("q4-zahlen", true);
      setHidden("rechenbeispiele", true);
      setHidden("gutachter-details", true);
      setHidden("buy-split", !state.buyOpen);
      setHidden("role-grid", state.buyOpen);
      setHidden("gate-heading", false);
      return { path: null, phase: "start", showInsight: false };
    }

    var afaPath = !!AFA_PATHS[rolle];
    var ausweisPath = !!AUSWEIS_PATHS[rolle];
    var haveYear = yearKnown(facts);
    var showInsight = ausweisPath || (afaPath && haveYear);
    var phase = showInsight ? "insight" : "context";

    $("main").setAttribute("data-phase", phase);

    // Beat 0 collapses once the insight is open: the answers rail carries the
    // role badge and the reset link, so the four cards stop dominating.
    setBeatOpen("q1-role", !showInsight);
    setHidden("role-grid", showInsight);
    setHidden("gate-heading", showInsight);
    setHidden("buy-split", true);
    state.buyOpen = false;

    setBeatOpen("q2-context", true);
    setHidden("q2-body", false);

    setHidden("q2-object-fields", !afaPath);
    setHidden("year-field", !afaPath);
    setHidden("q2-edu", !ausweisPath);

    // Beat 2: nothing beyond the year until the year is a finite integer.
    setHidden("mod-group", !(afaPath && haveYear));
    setHidden("vermieter-anlass-block", rolle !== "vermieter");
    setHidden("ausweis-block", afaPath && !haveYear);
    updateModJahrVisibility();

    $("role-badge").textContent =
      t("role.badgePrefix") + " " + t("role." + rolle);

    if (ausweisPath) {
      $("q2-edu-text").textContent =
        rolle === "mieter" ? t("mieter.ausweisOnly") : t("edu.ausweisPath");
    }

    setBeatOpen("q3-insight", showInsight);
    setBeatOpen("q4-next", showInsight);
    setHidden("q3-body", !showInsight);
    setHidden("q4-body", !showInsight);

    // Beat 4 and the two expanders exist only where AfA/RND applies.
    setHidden("q4-zahlen", !(afaPath && showInsight));
    setHidden("rechenbeispiele", !(afaPath && showInsight));
    setHidden("gutachter-details", !(afaPath && showInsight));

    return {
      path: afaPath ? "afa" : "ausweis",
      phase: phase,
      showInsight: showInsight,
    };
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

  /** Four legal sentences, then the posture word. Never a diagnosed ND. */
  function renderLagebild(routed) {
    if (!routed.afa || routed.afa.blocked) {
      return '<section class="lagebild">' + para(t("afa.needYear")) + "</section>";
    }
    var beat1 = t("lagebild.beat1")
      .split("{satzPct}")
      .join(String(routed.afa.satzPct).replace(".", ","))
      .split("{ndJahre}")
      .join(String(routed.afa.gesetzlicheNdJahre));

    var html =
      '<section class="lagebild" id="lagebild">' +
      "<h2>" +
      escapeHtml(t("lagebild.title")) +
      " " +
      termBtn("afa", t("glossary.afa")) +
      " " +
      termBtn("rnd", t("glossary.rnd")) +
      "</h2>" +
      para(t("modell.caption"), "modell-caption") +
      "<p>" +
      escapeHtml(beat1) +
      " " +
      termBtn("gesetzliche_groesse", t("glossary.gesetzliche_groesse")) +
      "</p>" +
      "<p>" +
      escapeHtml(t("lagebild.beat2")) +
      " " +
      termBtn("nachweis", t("glossary.nachweis")) +
      "</p>" +
      "<p>" +
      escapeHtml(t("lagebild.beat3")) +
      " " +
      termBtn("szenario_nd", t("glossary.szenario_nd")) +
      "</p>" +
      para(t("lagebild.beat4")) +
      '<p class="posture"><strong>' +
      escapeHtml(t("posture.lead") + ": " + postureLabel(routed.rndPosture)) +
      "</strong> " +
      escapeHtml(t(postureBodyKey(routed.rndPosture))) +
      "</p>";

    if (routed.rndReasons && routed.rndReasons.indexOf("gutachten_vorhanden") !== -1) {
      html += para(t("rnd.gutachtenVorhanden"), "note");
    } else if (routed.rndPosture === "suppress") {
      html += para(t("rnd.unwirtschaftlich"), "note");
    } else if (routed.rndPosture === "widen") {
      html += para(t("rnd.widenNote"), "note");
    }

    html +=
      para(t("deg5a.outOfScope"), "meta") + para(t("scope.outOfScope"), "meta");
    return html + "</section>";
  }

  /** Role lesson for the paths that never see AfA or ND scenarios. */
  function renderRoleLesson(routed) {
    var rolle = routed.rolle;
    var html = '<section class="lesson">' + "<h2>" + escapeHtml(t("q3.lessonTitle")) + "</h2>";

    if (rolle === "mieter") {
      html += para(t("mieter.ausweisOnly")) + para(t("lesson.mieter"));
    } else if (rolle === "verkaeufer") {
      html += para(t("edu.ausweisPath")) + para(t("lesson.verkaeufer"));
    } else {
      html += para(t("edu.ausweisPath")) + para(t("lesson.kaeufer_eigen"));
    }

    var gegKey = "geg.keinAnlass";
    if (routed.geg === "pflicht_orientierung") gegKey = "geg.pflicht";
    else if (routed.geg === "ausnahme_pruefen") gegKey = "geg.ausnahme";
    else if (routed.geg === "vorhanden") gegKey = "geg.vorhanden";
    html +=
      "<p>" +
      escapeHtml(t(gegKey)) +
      " " +
      termBtn("energieausweis", t("glossary.energieausweis")) +
      "</p>";

    if (rolle === "mieter") {
      html +=
        "<h2>" +
        escapeHtml(t("mieter.checklistTitle")) +
        "</h2><ul>" +
        "<li>" +
        escapeHtml(t("mieter.check1")) +
        "</li><li>" +
        escapeHtml(t("mieter.check2")) +
        "</li><li>" +
        escapeHtml(t("mieter.check3")) +
        "</li></ul>" +
        para(t("mieter.forward"), "note");
    }

    return html + "</section>";
  }

  /** Scenario table: euro columns appear only once the user typed the inputs. */
  function renderScenarioTable(routed) {
    if (!routed.scenarios || !routed.scenarios.length) return "";
    var showMehr = routed.gebaeudeanteilEur != null;
    var showTax = showMehr && routed.grenzsatzPct != null;
    var showAmort = showTax && routed.honorarEur != null;

    var html =
      '<table class="scenarios"><thead><tr><th>' +
      escapeHtml(t("table.szenario")) +
      "</th><th>" +
      escapeHtml(t("table.satz")) +
      "</th>";
    if (showMehr) html += "<th>" + escapeHtml(t("label.mehrAfa")) + "</th>";
    if (showTax) html += "<th>" + escapeHtml(t("label.steuerCash")) + "</th>";
    if (showAmort) html += "<th>" + escapeHtml(t("label.amort")) + "</th>";
    html += "</tr></thead><tbody>";

    for (var i = 0; i < routed.scenarios.length; i++) {
      var sc = routed.scenarios[i];
      var szenSatz = sc.ndJahre ? Math.round((100 / sc.ndJahre) * 1000) / 1000 : null;
      html +=
        "<tr><td>" +
        escapeHtml(sc.label) +
        "</td><td>" +
        escapeHtml(formatPct(szenSatz)) +
        "</td>";
      if (showMehr) {
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
    html += "</tbody></table>" + para(t("modell.caption"), "modell-caption");
    return html;
  }

  function renderRechenbeispieleBody(routed) {
    var html = renderScenarioTable(routed);

    html +=
      "<p>" +
      escapeHtml(t("kpa.arbeitshilfeVsGutachten")) +
      " " +
      termBtn("arbeitshilfe", t("glossary.arbeitshilfe")) +
      "</p>";

    if (routed.kpaCompare) {
      html +=
        "<h3>" +
        escapeHtml(t("kpa.compareTitle")) +
        "</h3><ul><li>A: " +
        escapeHtml(formatPct(routed.kpaCompare.a.splitPct)) +
        " → " +
        escapeHtml(formatEuro(routed.kpaCompare.a.gebaeudeanteilEur)) +
        "</li><li>B: " +
        escapeHtml(formatPct(routed.kpaCompare.b.splitPct)) +
        " → " +
        escapeHtml(formatEuro(routed.kpaCompare.b.gebaeudeanteilEur)) +
        "</li></ul>";
    }

    html +=
      '<details class="rechtslage-box"><summary>' +
      escapeHtml(t("details.hintergrund")) +
      "</summary><p>" +
      escapeHtml(t("rnd.rechtslage")) +
      "</p></details>";

    return html;
  }

  /** One hero CTA. suppress never links RND; widen only ever gets a text link. */
  function renderNextStep(routed, path) {
    var rolle = routed.rolle;
    var handoff = routed.handoff || {};
    var html = "<h2>" + escapeHtml(t("q4.title")) + "</h2>";

    function ausweisCta() {
      // Mieter never gets a hero button: there is nothing to save here.
      return rolle === "mieter"
        ? renderCta("ausweis", "primary", "cta.ausweisText", "text")
        : renderCta("ausweis", "primary", "cta.ausweis", "button");
    }

    if (path === "ausweis") {
      if (handoff.ausweis) html += ausweisCta();
      else if (handoff.kpa) html += renderCta("kpa", "primary", "cta.kpa", "button");
      return html;
    }

    if (routed.rndCta && routed.rndCta.primary) {
      html += renderCta("rnd", "primary", "cta.rndPrimary", "button");
    } else if (handoff.kpa) {
      html += renderCta("kpa", "primary", "cta.kpa", "button");
    } else if (handoff.ausweis) {
      html += ausweisCta();
    }

    if (routed.rndCta && routed.rndCta.secondaryText) {
      html += renderCta("rnd", "secondary", "cta.rndSecondary", "text");
    }
    return html;
  }

  function assertNoForbidden(text) {
    for (var i = 0; i < FORBIDDEN.length; i++) {
      if (text.indexOf(FORBIDDEN[i]) !== -1) {
        console.error("Forbidden string in rendered output:", FORBIDDEN[i]);
      }
    }
  }

  function renderAll() {
    if (!state.ready) return;
    var facts = readFacts();
    var unlocked = unlock(facts);

    if (!unlocked.showInsight) {
      $("q3-body").innerHTML = "";
      $("q4-body").innerHTML = "";
      $("rechenbeispiele-body").innerHTML = "";
      return;
    }

    var routed = NC.route(facts, state.ruleset);

    if (unlocked.path === "afa") {
      $("q3-body").innerHTML = renderLagebild(routed);
      $("rechenbeispiele-body").innerHTML = renderRechenbeispieleBody(routed);
    } else {
      $("q3-body").innerHTML = renderRoleLesson(routed);
      $("rechenbeispiele-body").innerHTML = "";
    }

    $("q4-body").innerHTML = renderNextStep(routed, unlocked.path);

    assertNoForbidden(
      ($("q3-body").textContent || "") +
        "\n" +
        ($("rechenbeispiele-body").textContent || "") +
        "\n" +
        ($("q4-body").textContent || "")
    );
  }

  function hidePopover() {
    var pop = $("term-popover");
    pop.hidden = true;
    pop.textContent = "";
  }

  function showPopover(btn) {
    var pop = $("term-popover");
    pop.textContent = t("glossary." + btn.getAttribute("data-term"));
    pop.hidden = false;
    var rect = btn.getBoundingClientRect();
    pop.style.top = rect.bottom + window.scrollY + 6 + "px";
    pop.style.left =
      Math.min(rect.left + window.scrollX, window.scrollX + window.innerWidth - 300) +
      "px";
  }

  function resetRole() {
    $("rolle").value = "";
    $("anlass").value = "";
    $("nutzung").value = "";
    $("fertigstellungJahr").value = "";
    $("modernisierungJahr").value = "";

    var unbekannt = document.querySelector(
      'input[name="modernisierung"][value="unbekannt"]'
    );
    if (unbekannt) unbekannt.checked = true;
    var ausweisUnbekannt = document.querySelector(
      'input[name="ausweis"][value="unbekannt"]'
    );
    if (ausweisUnbekannt) ausweisUnbekannt.checked = true;
    var halten = document.querySelector(
      'input[name="vermieter_anlass"][value="halten"]'
    );
    if (halten) halten.checked = true;
    var gutachten = $("gutachtenVorhanden");
    if (gutachten) gutachten.checked = false;

    var money = [
      "gebaeudeanteilEur",
      "kaufpreisEur",
      "splitPct",
      "grenzsatzPct",
      "honorarEur",
      "splitPctA",
      "splitPctB",
    ];
    for (var i = 0; i < money.length; i++) {
      var el = $(money[i]);
      if (el) el.value = "";
    }

    closeDetails("zahlen-details");
    closeDetails("rechenbeispiele");
    closeDetails("gutachter-details");

    state.buyOpen = false;
    $("main").setAttribute("data-phase", "start");
    hidePopover();
    renderAll();
  }

  function selectRole(rolle) {
    syncHiddenFromRolle(rolle);
    state.buyOpen = false;
    renderAll();
  }

  /** Fill every data-copy / data-copy-placeholder / data-copy-aria node. */
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
    var presets = document.querySelectorAll("[data-set-grenz]");
    for (var p = 0; p < presets.length; p++) {
      presets[p].textContent = t("annahme.presetGrenz")
        .split("{pct}")
        .join(presets[p].getAttribute("data-set-grenz"));
    }
    var hPreset = document.querySelector("[data-set-honorar]");
    if (hPreset) hPreset.textContent = t("annahme.presetHonorar");
  }

  function renderChrome() {
    var name = t("product.name");
    document.title = name;
    $("brand").textContent = name;
    var version = state.ruleset ? state.ruleset.version : "—";
    var stand = state.ruleset ? state.ruleset.stand : "—";
    $("footer-meta").textContent =
      name +
      " · " +
      version +
      " · " +
      stand +
      " · " +
      t("footer.disclaimer") +
      " " +
      t("legal.keineSteuerberatung");
    $("footer-disclaimer").textContent = t("footer.disclaimer");
    $("rechtslage-body").textContent = t("rnd.rechtslage");
    $("impressum-body").innerHTML = [
      escapeHtml(t("impressum.betreiber")),
      escapeHtml(t("impressum.anschrift")),
      escapeHtml(t("impressum.kontakt")),
      escapeHtml(t("impressum.ustId")),
      escapeHtml(t("impressum.verantwortlich")),
    ].join("<br>");
    $("datenschutz-body").innerHTML =
      para(t("datenschutz.keinObjektbezug")) +
      para(t("datenschutz.hosterHinweis")) +
      para(t("legal.keineSteuerberatung"));
    applyCopyBindings();
    NC.skin.apply(state.skin, t);
  }

  function bindPrint() {
    window.addEventListener("beforeprint", function () {
      var all = document.querySelectorAll("details");
      var restore = [];
      for (var i = 0; i < all.length; i++) {
        restore.push({ el: all[i], open: all[i].open });
        all[i].open = true;
      }
      state.printRestore = restore;
    });
    window.addEventListener("afterprint", function () {
      var restore = state.printRestore || [];
      for (var i = 0; i < restore.length; i++) {
        restore[i].el.open = restore[i].open;
      }
      state.printRestore = null;
    });
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
        setHidden("buy-split", false);
        setHidden("role-grid", true);
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
      setHidden("buy-split", true);
      setHidden("role-grid", false);
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

    bindPrint();
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
      .then(function (loaded) {
        state.ruleset = loaded[0];
        state.copy = loaded[1];
        state.skin = loaded[3] || {};
        state.ready = true;
        renderChrome();
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
