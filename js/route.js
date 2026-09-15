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

  /**
   * @returns visibility + calc snapshots. Never invents userNdJahre.
   */
  function route(facts, ruleset) {
    facts = facts || {};
    var nutzung = facts.nutzung;
    var anlass = facts.anlass;

    var showAfa =
      nutzung === "vermieter_wohnen" ||
      nutzung === "gemischt" ||
      nutzung === "nichtwohnen";

    if (nutzung === "eigengenutzt" && anlass === "halten") {
      showAfa = false;
    }

    var afa = NC.afaFromFacts(facts, ruleset);
    var postureResult = NC.rndPosture(facts, ruleset);
    var posture = postureResult.posture;

    var showRnd = showAfa && yearKnown(facts);

    var showKpa =
      anlass === "kaufen" ||
      ((nutzung === "vermieter_wohnen" || nutzung === "gemischt") && hasPriceInput(facts));

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

    var handoffRnd = showRnd && posture === "primary";
    var handoffKpa = showKpa;
    var handoffAusweis =
      showAusweis && geg !== "kein_anlass" && geg !== "vorhanden"
        ? true
        : showAusweis &&
          (geg === "pflicht_orientierung" || geg === "ausnahme_pruefen");

    if (
      showAusweis &&
      (anlass === "verkauf" || anlass === "neu_vermietung" || anlass === "neubau")
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
      version: ruleset && ruleset.version,
      stand: ruleset && ruleset.stand,
    };
  }

  NC.route = route;
})(typeof globalThis !== "undefined" ? globalThis : this);
