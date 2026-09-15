import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadNC, loadRuleset, loadFixture, assertNoUserNd } from "./load.mjs";

const NC = loadNC();
const ruleset = loadRuleset();

describe("afaFromFacts", () => {
  it("blocks when Fertigstellung unknown", () => {
    const r = NC.afaFromFacts({ fertigstellungJahr: null }, ruleset);
    assert.equal(r.blocked, "fertigstellung_unbekannt");
    assert.equal(r.satzPct, undefined);
  });

  it("Nr. 2a after 2022-12-31 → 3/33", () => {
    const r = NC.afaFromFacts({ fertigstellungJahr: 2024 }, ruleset);
    assert.equal(r.satzPct, 3);
    assert.equal(r.gesetzlicheNdJahre, 33);
    assert.equal(r.rowId, "nr2a_fertig_ab_2023");
    assert.equal(r.modell, true);
  });

  it("Nr. 2b after 1924-12-31 → 2/50", () => {
    const r = NC.afaFromFacts({ fertigstellungJahr: 1966 }, ruleset);
    assert.equal(r.satzPct, 2);
    assert.equal(r.gesetzlicheNdJahre, 50);
    assert.equal(r.rowId, "nr2b_fertig_1925_2022");
  });

  it("Nr. 2c else → 2.5/40", () => {
    const r = NC.afaFromFacts({ fertigstellungJahr: 1920 }, ruleset);
    assert.equal(r.satzPct, 2.5);
    assert.equal(r.gesetzlicheNdJahre, 40);
    assert.equal(r.rowId, "nr2c_fertig_vor_1925");
  });

  it("boundary 1925 is 2/50", () => {
    const r = NC.afaFromFacts({ fertigstellungJahr: 1925 }, ruleset);
    assert.equal(r.satzPct, 2);
  });

  it("boundary 2022 is 2/50", () => {
    const r = NC.afaFromFacts({ fertigstellungJahr: 2022 }, ruleset);
    assert.equal(r.satzPct, 2);
  });

  it("boundary 2023 is 3/33", () => {
    const r = NC.afaFromFacts({ fertigstellungJahr: 2023 }, ruleset);
    assert.equal(r.satzPct, 3);
  });
});

describe("mehrAfa", () => {
  it("150000 @ 2% vs ND 30 → mehrAfaEur 2000", () => {
    const r = NC.mehrAfa(150000, 2, 30);
    assert.equal(r.modell, true);
    assert.equal(r.mehrAfaEur, 2000);
    assert.equal(r.afaGesetzlichEur, 3000);
    assert.equal(r.afaSzenarioEur, 5000);
  });

  it("missing anteil → ratesOnly, no invented euros", () => {
    const r = NC.mehrAfa(null, 2, 30);
    assert.equal(r.ratesOnly, true);
    assert.equal(r.mehrAfaEur, undefined);
  });
});

describe("resolveGebaeudeanteil", () => {
  it("does not invent 62/38 from PLZ", () => {
    const a = NC.resolveGebaeudeanteil({
      kaufpreisEur: 400000,
      plz: "80331",
    });
    assert.equal(a, null);
  });

  it("uses user splitPct when provided", () => {
    const a = NC.resolveGebaeudeanteil({
      kaufpreisEur: 400000,
      splitPct: 60,
    });
    assert.equal(a, 240000);
  });
});

describe("rndPosture", () => {
  it("fertigstellung >= 1996 → suppress", () => {
    const r = NC.rndPosture(
      { fertigstellungJahr: 2020, modernisierung: "keine" },
      ruleset
    );
    assert.equal(r.posture, "suppress");
  });

  it("umfassend && modernisierungJahr >= 2016 → suppress", () => {
    const r = NC.rndPosture(
      {
        fertigstellungJahr: 1966,
        modernisierung: "umfassend",
        modernisierungJahr: 2019,
      },
      ruleset
    );
    assert.equal(r.posture, "suppress");
  });

  it("modernisierung unbekannt → widen", () => {
    const r = NC.rndPosture(
      { fertigstellungJahr: 1966, modernisierung: "unbekannt" },
      ruleset
    );
    assert.equal(r.posture, "widen");
  });

  it("known year not suppressed → primary", () => {
    const r = NC.rndPosture(
      { fertigstellungJahr: 1966, modernisierung: "keine" },
      ruleset
    );
    assert.equal(r.posture, "primary");
  });

  it("never returns userNdJahre", () => {
    const r = NC.rndPosture(
      { fertigstellungJahr: 1966, modernisierung: "keine" },
      ruleset
    );
    assertNoUserNd(r, assert);
  });
});

describe("gegOrientierung", () => {
  it("vorhanden when ausweis vorhanden", () => {
    assert.equal(
      NC.gegOrientierung({ ausweis: "vorhanden", anlass: "verkauf" }, ruleset),
      "vorhanden"
    );
  });

  it("pflicht on verkauf without ausweis", () => {
    assert.equal(
      NC.gegOrientierung(
        { ausweis: "nicht_vorhanden", anlass: "verkauf" },
        ruleset
      ),
      "pflicht_orientierung"
    );
  });

  it("kein_anlass eigengenutzt halten", () => {
    assert.equal(
      NC.gegOrientierung(
        {
          ausweis: "unbekannt",
          anlass: "halten",
          nutzung: "eigengenutzt",
        },
        ruleset
      ),
      "kein_anlass"
    );
  });
});

describe("fixtures vs ruleset", () => {
  const files = [
    "etw-1966-unmod-vermiet.json",
    "etw-1966-mod-2019.json",
    "nb-2020-vermiet.json",
    "nb-2024-vermiet.json",
    "pre-1925.json",
    "year-unknown.json",
    "modern-unbekannt-1966.json",
    "gemischt-single-anteil.json",
    "kpa-no-plz.json",
  ];

  for (const file of files) {
    it(file, () => {
      const fx = loadFixture(file);
      const afa = NC.afaFromFacts(fx.facts, ruleset);
      const posture = NC.rndPosture(fx.facts, ruleset);
      assertNoUserNd({ afa, posture }, assert);

      if (fx.expect.afa) {
        if (fx.expect.afa.blocked) {
          assert.equal(afa.blocked, fx.expect.afa.blocked);
        } else {
          assert.equal(afa.satzPct, fx.expect.afa.satzPct);
          assert.equal(afa.gesetzlicheNdJahre, fx.expect.afa.gesetzlicheNdJahre);
          if (fx.expect.afa.rowId) assert.equal(afa.rowId, fx.expect.afa.rowId);
        }
      }
      if (fx.expect.rndPosture) {
        assert.equal(posture.posture, fx.expect.rndPosture);
      }
      if (fx.expect.mehrAfaNd30 != null) {
        const m = NC.mehrAfa(fx.facts.gebaeudeanteilEur, afa.satzPct, 30);
        assert.equal(m.mehrAfaEur, fx.expect.mehrAfaNd30);
      }
      if (fx.expect.gebaeudeanteilEur === null) {
        assert.equal(NC.resolveGebaeudeanteil(fx.facts), null);
      }
      if (fx.expect.gebaeudeanteilEur != null) {
        assert.equal(
          NC.resolveGebaeudeanteil(fx.facts),
          fx.expect.gebaeudeanteilEur
        );
      }
    });
  }
});
