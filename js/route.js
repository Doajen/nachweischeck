/**
 * Pure gate → card / handoff routing. No DOM.
 * Requires NC.calc helpers already attached. Attaches NC.route.
 */
(function (g) {
  "use strict";

  var NC = g.NC || (g.NC = {});

  function yearKnown(facts) {
    if (!facts || facts.fertigstellungJahr === "" || facts.fertigstellungJahr == null) {
      return false;
    }
    var y = Number(facts.fertigstellungJahr);
    return Number.isFinite(y) && y === Math.trunc(y);
  }

  function hasPriceInput(facts) {
    if (!facts) return false;
    if (Number.isFinite(facts.gebaeudeanteilEur)) return true;
    if (Number.isFinite(facts.kaufpreisEur)) return true;
    return false;
  }

  /**
   * Map facts.rolle → anlass/nutzung. Existing anlass/nutzung still work if no rolle.
   * vermieter → vermieter_wohnen + halten|neu_vermietung
   * kaeufer_vermiet → kaufen + vermieter_wohnen
   * kaeufer_eigen → kaufen + eigengenutzt
   * verkaeufer → verkauf
   * mieter → rolle only
   */
  function applyRolle(facts) {
    var f = {};
    var k;
    for (k in facts) {
      if (Object.prototype.hasOwnProperty.call(facts, k)) f[k] = facts[k];
    }
    var rolle = f.rolle;
    if (!rolle) return f;

    if (rolle === "vermieter") {
      f.nutzung = "vermieter_wohnen";
      f.anlass = f.anlass === "neu_vermietung" ? "neu_vermietung" : "halten";
    } else if (rolle === "kaeufer_vermiet") {
      f.anlass = "kaufen";
      f.nutzung = "vermieter_wohnen";
    } else if (rolle === "kaeufer_eigen") {
      f.anlass = "kaufen";
      f.nutzung = "eigengenutzt";
    } else if (rolle === "verkaeufer") {
      f.anlass = "verkauf";
    }
    // mieter: leave anlass/nutzung unset for AfA; route short-circuits
    return f;
  }

  function attachScenarioExtras(entry, facts) {
    if (!entry.mehrAfa || entry.mehrAfa.ratesOnly) return entry;
    var steuern = NC.steuerCash(entry.mehrAfa.mehrAfaEur, facts.grenzsatzPct);
    entry.steuerCash = steuern;
    if (!steuern.ratesOnly) {
      entry.amort = NC.amortJahre(facts.honorarEur, steuern.eurJahr);
    } else {
      entry.amort = { modell: true, ratesOnly: true };
    }
    return entry;
  }

  function buildKpaCompare(facts, afa) {
    if (
      !facts ||
      !Number.isFinite(facts.kaufpreisEur) ||
      !Number.isFinite(facts.splitPctA) ||
      !Number.isFinite(facts.splitPctB) ||
      !afa ||
      afa.blocked ||
      !Number.isFinite(afa.satzPct)
    ) {
      return null;
    }
    var aAnteil = facts.kaufpreisEur * (facts.splitPctA / 100);
    var bAnteil = facts.kaufpreisEur * (facts.splitPctB / 100);
    return {
      a: {
        splitPct: facts.splitPctA,
        gebaeudeanteilEur: aAnteil,
        afaGesetzlichEur: aAnteil * (afa.satzPct / 100),
        modell: true,
      },
      b: {
        splitPct: facts.splitPctB,
        gebaeudeanteilEur: bAnteil,
        afaGesetzlichEur: bAnteil * (afa.satzPct / 100),
        modell: true,
      },
    };
  }

  function emptyResult(facts, ruleset, extra) {
    return Object.assign(
      {
        cards: { afa: false, rnd: false, kpa: false, ausweis: false },
        handoff: { rnd: false, kpa: false, ausweis: false },
        rndCta: { primary: false, secondaryText: false, hidden: true },
        rndPosture: null,
        rndReasons: [],
        afa: { blocked: "fertigstellung_unbekannt", modell: true },
        geg: "kein_anlass",
        gebaeudeanteilEur: null,
        grenzsatzPct: null,
        honorarEur: null,
        scenarios: [],
        kpaCompare: null,
        rolle: facts && facts.rolle ? facts.rolle : null,
        version: ruleset && ruleset.version,
        stand: ruleset && ruleset.stand,
      },
      extra || {}
    );
  }

  /**
   * @returns visibility + calc snapshots. Never invents userNdJahre.
   */
  function route(facts, ruleset) {
    facts = applyRolle(facts || {});
    var rolle = facts.rolle || null;

    if (rolle === "mieter") {
      return emptyResult(facts, ruleset, {
        cards: { afa: false, rnd: false, kpa: false, ausweis: true },
        handoff: { rnd: false, kpa: false, ausweis: true },
        geg: "pflicht_orientierung",
        rolle: "mieter",
      });
    }

    var nutzung = facts.nutzung;
    var anlass = facts.anlass;

    var showAfa =
      nutzung === "vermieter_wohnen" ||
      nutzung === "gemischt" ||
      nutzung === "nichtwohnen";

    if (nutzung === "eigengenutzt" && (anlass === "halten" || anlass === "kaufen")) {
      showAfa = false;
    }

    var afa = NC.afaFromFacts(facts, ruleset);
    var postureResult = NC.rndPosture(facts, ruleset);
    var posture = postureResult.posture;

    var showRnd = showAfa && yearKnown(facts);

    var showKpa =
      anlass === "kaufen" ||
      ((nutzung === "vermieter_wohnen" || nutzung === "gemischt") && hasPriceInput(facts));

    // Käufer eigen: KPA optional (Kaufpreis), but no RND/AfA
    if (rolle === "kaeufer_eigen") {
      showAfa = false;
      showRnd = false;
    }

    var geg = NC.gegOrientierung(facts, ruleset);
    var showAusweis = true;
    if (
      nutzung === "eigengenutzt" &&
      anlass === "halten" &&
      facts.ausweis === "vorhanden"
    ) {
      showAusweis = false;
    } else if (geg === "kein_anlass" && facts.ausweis === "vorhanden") {
      showAusweis = false;
    }

    // Verkäufer / Käufer eigen / Mieter: Ausweis orientation always available
    if (rolle === "verkaeufer" || rolle === "kaeufer_eigen") {
      showAusweis = true;
    }

    var handoffRnd = showRnd && posture === "primary";
    var handoffKpa = showKpa;
    var handoffAusweis =
      showAusweis && geg !== "kein_anlass" && geg !== "vorhanden"
        ? true
        : showAusweis &&
          (geg === "pflicht_orientierung" || geg === "ausnahme_pruefen");

    if (
      showAusweis &&
      (anlass === "verkauf" ||
        anlass === "neu_vermietung" ||
        anlass === "neubau" ||
        anlass === "kaufen" ||
        rolle === "verkaeufer" ||
        rolle === "kaeufer_eigen")
    ) {
      handoffAusweis = true;
    }
    if (!showAusweis) handoffAusweis = false;

    var anteil = NC.resolveGebaeudeanteil(facts);
    var scenarios = [];
    if (showRnd && afa && !afa.blocked && Array.isArray(ruleset && ruleset.rndScenarios)) {
      for (var i = 0; i < ruleset.rndScenarios.length; i++) {
        var sc = ruleset.rndScenarios[i];
        var entry = {
          id: sc.id,
          label: sc.label,
          ndJahre: sc.ndJahre,
          satzPct: afa.satzPct,
          gesetzlicheNdJahre: afa.gesetzlicheNdJahre,
          modell: true,
        };
        if (anteil != null) {
          var m = NC.mehrAfa(anteil, afa.satzPct, sc.ndJahre);
          entry.mehrAfa = m;
          attachScenarioExtras(entry, facts);
        }
        scenarios.push(entry);
      }
    }

    var kpaCompare = buildKpaCompare(facts, afa);

    return {
      cards: {
        afa: showAfa,
        rnd: showRnd,
        kpa: showKpa,
        ausweis: showAusweis,
      },
      handoff: {
        rnd: handoffRnd,
        kpa: handoffKpa,
        ausweis: !!handoffAusweis,
      },
      rndCta: {
        primary: posture === "primary" && showRnd,
        secondaryText: posture === "widen" && showRnd,
        hidden: posture === "suppress" || !showRnd,
      },
      rndPosture: posture,
      rndReasons: postureResult.reasons,
      afa: afa,
      geg: geg,
      gebaeudeanteilEur: anteil,
      grenzsatzPct: Number.isFinite(facts.grenzsatzPct) ? facts.grenzsatzPct : null,
      honorarEur: Number.isFinite(facts.honorarEur) ? facts.honorarEur : null,
      scenarios: scenarios,
      kpaCompare: kpaCompare,
      rolle: rolle,
      version: ruleset && ruleset.version,
      stand: ruleset && ruleset.stand,
    };
  }

  NC.applyRolle = applyRolle;
  NC.route = route;
})(typeof globalThis !== "undefined" ? globalThis : this);
