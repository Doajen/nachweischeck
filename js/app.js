/**
 * Gate UI + result cards + vendor CTAs. No persist, no analytics.
 */
(function () {
  "use strict";

  var state = {
    ruleset: null,
    copy: null,
    skin: {},
    ready: false,
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
    var raw = $(id).value;
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
    if (anteil != null) facts.gebaeudeanteilEur = anteil;
    if (kauf != null) facts.kaufpreisEur = kauf;
    if (split != null) facts.splitPct = split;
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

  /**
   * CTA block: Werbung + Vertrag, then link.
   * @param {"button"|"text"} variant
   */
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

  function renderFooter() {
    var name = t("product.name");
    document.title = name;
    var version = state.ruleset ? state.ruleset.version : "—";
    var stand = state.ruleset ? state.ruleset.stand : "—";
    $("footer-meta").textContent =
      name + " · Ruleset " + version + " · Stand " + stand;
    $("footer-disclaimer").textContent = t("footer.disclaimer");
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
    NC.skin.apply(state.skin, t);
  }

  function renderAfaCard(routed) {
    var html =
      '<article class="card" id="card-afa"><h2>Gesetzliche AfA (§ 7 Abs. 4 Satz 1 Nr. 2)</h2>';
    html += '<p class="modell">Modellrechnung</p>';
    if (routed.afa && routed.afa.blocked) {
      html +=
        "<p>Ohne Fertigstellungsjahr keine gesetzliche Satz-Zuordnung. Es wird kein Satz erfunden.</p>";
    } else if (routed.afa) {
      html +=
        "<p>Gesetzlicher Satz: <strong>" +
        escapeHtml(formatPct(routed.afa.satzPct)) +
        "</strong> " +
        "(gesetzliche ND-Größe: " +
        escapeHtml(String(routed.afa.gesetzlicheNdJahre)) +
        " Jahre).</p>";
      if (
        readFacts().nutzung === "nichtwohnen" ||
        readFacts().nutzung === "gemischt"
      ) {
        html +=
          '<p class="note">' + escapeHtml(t("afa.nichtwohnenHinweis")) + "</p>";
      }
      html += '<p class="note">' + escapeHtml(t("deg5a.outOfScope")) + "</p>";
    }
    html += "</article>";
    return html;
  }

  function renderRndCard(routed) {
    var html =
      '<article class="card" id="card-rnd"><h2>RND-Szenarien (keine Restnutzungsdauer-Feststellung)</h2>';
    html += '<p class="modell">Modellrechnung</p>';
    html += "<p>" + escapeHtml(t("rnd.rechtslage")) + "</p>";

    if (routed.rndPosture === "suppress") {
      html +=
        '<p class="note note-strong">' +
        escapeHtml(t("rnd.unwirtschaftlich")) +
        "</p>";
    } else if (routed.rndPosture === "widen") {
      html += '<p class="note">' + escapeHtml(t("rnd.widenNote")) + "</p>";
    }

    if (routed.scenarios && routed.scenarios.length) {
      html +=
        '<table class="scenarios"><thead><tr>' +
        "<th>Szenario</th><th>Gesetzlicher Satz</th><th>Szenario-Satz</th>";
      if (routed.gebaeudeanteilEur != null) {
        html += "<th>Mehr-AfA €/Jahr</th>";
      }
      html += "</tr></thead><tbody>";
      for (var i = 0; i < routed.scenarios.length; i++) {
        var sc = routed.scenarios[i];
        var szenSatz = sc.ndJahre ? 100 / sc.ndJahre : null;
        html +=
          "<tr><td>" +
          escapeHtml(sc.label) +
          "</td><td>" +
          escapeHtml(formatPct(sc.satzPct)) +
          "</td><td>" +
          escapeHtml(formatPct(Math.round(szenSatz * 1000) / 1000)) +
          "</td>";
        if (
          routed.gebaeudeanteilEur != null &&
          sc.mehrAfa &&
          !sc.mehrAfa.ratesOnly
        ) {
          html +=
            '<td class="euro">' +
            escapeHtml(formatEuro(sc.mehrAfa.mehrAfaEur)) +
            "</td>";
        } else if (routed.gebaeudeanteilEur != null) {
          html += "<td>—</td>";
        }
        html += "</tr>";
      }
      html += "</tbody></table>";
    }

    if (routed.rndCta && routed.rndCta.primary) {
      html += renderCta("rnd", "primary", "cta.rndPrimary", "button");
    }
    if (routed.rndCta && routed.rndCta.secondaryText) {
      html += renderCta("rnd", "secondary", "cta.rndSecondary", "text");
    }
    // suppress → no RND links (both flags false / hidden)

    html += "</article>";
    return html;
  }

  function renderKpaCard(routed) {
    var html =
      '<article class="card" id="card-kpa"><h2>Kaufpreisaufteilung</h2>' +
      '<p class="modell">Modellrechnung</p>' +
      "<p>" +
      escapeHtml(t("kpa.arbeitshilfeVsGutachten")) +
      "</p>";
    if (routed.handoff && routed.handoff.kpa) {
      html += renderCta("kpa", "primary", "cta.kpa", "button");
    }
    html += "</article>";
    return html;
  }

  function renderAusweisCard(routed) {
    var key = "geg.keinAnlass";
    if (routed.geg === "pflicht_orientierung") key = "geg.pflicht";
    else if (routed.geg === "ausnahme_pruefen") key = "geg.ausnahme";
    else if (routed.geg === "vorhanden") key = "geg.vorhanden";

    var html =
      '<article class="card" id="card-ausweis"><h2>Energieausweis (Orientierung)</h2>' +
      "<p>" +
      escapeHtml(t(key)) +
      "</p>";
    if (routed.handoff && routed.handoff.ausweis) {
      html += renderCta("ausweis", "primary", "cta.ausweis", "button");
    }
    html += "</article>";
    return html;
  }

  function renderHandoff(routed) {
    var parts = "";
    if (routed.handoff && routed.handoff.rnd && routed.rndCta && routed.rndCta.primary) {
      parts += renderCta("rnd", "primary", "cta.rndPrimary", "button");
    }
    if (routed.handoff && routed.handoff.kpa) {
      parts += renderCta("kpa", "primary", "cta.kpa", "button");
    }
    if (routed.handoff && routed.handoff.ausweis) {
      parts += renderCta("ausweis", "primary", "cta.ausweis", "button");
    }
    if (!parts) return "";
    return (
      '<section class="handoff card" id="handoff">' +
      "<h2>" +
      escapeHtml(t("handoff.title")) +
      "</h2>" +
      parts +
      "</section>"
    );
  }

  function renderResults() {
    if (!state.ready) return;
    var facts = readFacts();
    var routed = NC.route(facts, state.ruleset);
    var box = $("results");
    var html = "";

    if (routed.cards.afa) html += renderAfaCard(routed);
    if (routed.cards.rnd) html += renderRndCard(routed);
    if (routed.cards.kpa) html += renderKpaCard(routed);
    if (routed.cards.ausweis) html += renderAusweisCard(routed);
    html += renderHandoff(routed);

    if (!html) {
      html =
        '<p class="note">Mit den aktuellen Angaben werden keine Ergebnis-Karten angezeigt.</p>';
    }

    box.innerHTML = html;
    box.hidden = false;

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

  function bindForm() {
    var form = $("gate-form");
    form.addEventListener("input", renderResults);
    form.addEventListener("change", renderResults);
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
        bindForm();
        renderResults();
      })
      .catch(function () {
        showBanner(
          "Ruleset/Copy/Affiliates konnte nicht geladen werden (z. B. file://). Bitte über http://localhost öffnen oder die gepackte HTML-Datei nutzen. Es werden keine AfA-Sätze erfunden."
        );
        state.ready = false;
        $("results").hidden = true;
        $("footer-meta").textContent = "Nachweischeck · Ruleset nicht geladen";
        $("footer-disclaimer").textContent =
          "Überschlägige Modellrechnung. Keine Steuerberatung. Keine Bewertung. Finanzamt entscheidet im Einzelfall.";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
