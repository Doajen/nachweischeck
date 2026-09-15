/**
 * Pure calculators for Nachweischeck. No DOM.
 * Attaches to globalThis.NC
 */
(function (g) {
  "use strict";

  var NC = g.NC || (g.NC = {});

  function yearFromFacts(facts) {
    if (!facts || facts.fertigstellungJahr === "" || facts.fertigstellungJahr == null) {
      return null;
    }
    var y = Number(facts.fertigstellungJahr);
    if (!Number.isFinite(y) || y !== Math.trunc(y)) return null;
    return y;
  }

  function parseIsoYear(iso) {
    if (!iso || typeof iso !== "string") return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    return Number(m[1]);
  }

  /**
   * Year-granular match against ruleset when-clauses.
   * nach 2022-12-31 → year > 2022; before 2023-01-01 → year < 2023.
   */
  function rowMatchesYear(year, when) {
    if (!when) return false;
    if (when.fallback === true) return true;

    if (when.fertigstellungAfter) {
      var afterY = parseIsoYear(when.fertigstellungAfter);
      if (afterY == null) return false;
      if (!(year > afterY)) return false;
    }

    if (when.fertigstellungBefore) {
      var beforeY = parseIsoYear(when.fertigstellungBefore);
      if (beforeY == null) return false;
      // ISO day 01-01 of year Y means year < Y
      if (!(year < beforeY)) return false;
    }

    return !!(when.fertigstellungAfter || when.fertigstellungBefore || when.fallback);
  }

  /**
   * First-match Nr. 2 table. Year unknown → blocked.
   */
  function afaFromFacts(facts, ruleset) {
    var year = yearFromFacts(facts);
    if (year == null) {
      return { blocked: "fertigstellung_unbekannt", modell: true };
    }
    var rows = (ruleset && ruleset.afa && ruleset.afa.rows) || [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!rowMatchesYear(year, row.when)) continue;
      return {
        satzPct: row.satzPct,
        gesetzlicheNdJahre: row.gesetzlicheNdJahre,
        normId: row.normId,
        rowId: row.id,
        modell: true,
      };
    }
    return { blocked: "keine_afa_zeile", modell: true };
  }

  /**
   * Full-year Modellrechnung. No § 7 Abs. 1 S. 4 twelfths.
   * mehrAfaEur = anteil * (1/ndJahre - satzPct/100)
   */
  function mehrAfa(gebaeudeanteilEur, satzPct, ndJahre) {
    if (
      !Number.isFinite(gebaeudeanteilEur) ||
      !Number.isFinite(satzPct) ||
      !Number.isFinite(ndJahre) ||
      ndJahre <= 0
    ) {
      return { modell: true, ratesOnly: true };
    }
    // Equivalent to anteil * (1/ndJahre - satzPct/100); subtract form avoids float noise.
    var afaGesetzlichEur = gebaeudeanteilEur * (satzPct / 100);
    var afaSzenarioEur = gebaeudeanteilEur / ndJahre;
    var mehrAfaEur = afaSzenarioEur - afaGesetzlichEur;
    return {
      afaGesetzlichEur: afaGesetzlichEur,
      afaSzenarioEur: afaSzenarioEur,
      mehrAfaEur: mehrAfaEur,
      modell: true,
    };
  }

  /**
   * Resolve Gebäudeanteil from user € or Kaufpreis × user split%.
   * Never invents PLZ split.
   */
  function resolveGebaeudeanteil(facts) {
    if (!facts) return null;
    if (Number.isFinite(facts.gebaeudeanteilEur)) return facts.gebaeudeanteilEur;
    if (Number.isFinite(facts.kaufpreisEur) && Number.isFinite(facts.splitPct)) {
      return facts.kaufpreisEur * (facts.splitPct / 100);
    }
    return null;
  }

  /**
   * @returns {{ posture: "primary"|"widen"|"suppress", reasons: string[] }}
   * Never returns userNdJahre.
   */
  function rndPosture(facts, ruleset) {
    var cfg = (ruleset && ruleset.rndPosture) || {};
    var year = yearFromFacts(facts);
    var reasons = [];
    var suppressFrom = cfg.suppressIfFertigstellungFrom;
    var modFrom = cfg.suppressIfUmfassendModernisiertFrom;
    var widenList = cfg.widenIfModernisierung || ["unbekannt"];

    if (year != null && Number.isFinite(suppressFrom) && year >= suppressFrom) {
      reasons.push("fertigstellung_ab_schwelle");
      return { posture: "suppress", reasons: reasons };
    }

    if (facts && facts.modernisierung === "umfassend") {
      var modJahr = Number(facts.modernisierungJahr);
      var modJahrOk =
        facts.modernisierungJahr !== "" &&
        facts.modernisierungJahr != null &&
        Number.isFinite(modJahr) &&
        modJahr === Math.trunc(modJahr);

      if (
        modJahrOk &&
        Number.isFinite(modFrom) &&
        modJahr >= modFrom
      ) {
        reasons.push("umfassend_ab_schwelle");
        return { posture: "suppress", reasons: reasons };
      }

      if (!modJahrOk) {
        reasons.push("umfassend_jahr_unbekannt");
        return { posture: "widen", reasons: reasons };
      }
    }

    if (facts && widenList.indexOf(facts.modernisierung) !== -1) {
      reasons.push("modernisierung_unbekannt");
      return { posture: "widen", reasons: reasons };
    }

    if (year != null) {
      return { posture: "primary", reasons: reasons };
    }

    reasons.push("fertigstellung_unbekannt");
    return { posture: "widen", reasons: reasons };
  }

  /**
   * GEG-ish orientation only.
   * @returns {"pflicht_orientierung"|"kein_anlass"|"ausnahme_pruefen"|"vorhanden"}
   */
  function gegOrientierung(facts, ruleset) {
    var geg = (ruleset && ruleset.geg) || {};
    var anlass = facts && facts.anlass;
    var nutzung = facts && facts.nutzung;
    var ausweis = facts && facts.ausweis;

    if (ausweis === "vorhanden") {
      return "vorhanden";
    }

    if (facts && (facts.klein_50qm === true || facts.denkmal === true)) {
      return "ausnahme_pruefen";
    }

    var kein = geg.keinAnlass || [];
    if (
      nutzung === "eigengenutzt" &&
      anlass === "halten" &&
      kein.indexOf("eigengenutzt_bestand_halten") !== -1
    ) {
      return "kein_anlass";
    }

    var pflicht = geg.pflichtAnlaesse || [];
    if (pflicht.indexOf(anlass) !== -1) {
      return "pflicht_orientierung";
    }

    if (ausweis === "nicht_vorhanden" || ausweis === "unbekannt") {
      return "pflicht_orientierung";
    }

    return "kein_anlass";
  }

  NC.afaFromFacts = afaFromFacts;
  NC.mehrAfa = mehrAfa;
  NC.resolveGebaeudeanteil = resolveGebaeudeanteil;
  NC.rndPosture = rndPosture;
  NC.gegOrientierung = gegOrientierung;
})(typeof globalThis !== "undefined" ? globalThis : this);
