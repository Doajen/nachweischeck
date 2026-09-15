import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadNC, loadRuleset, loadFixture, assertNoUserNd } from "./load.mjs";

const NC = loadNC();
const ruleset = loadRuleset();

describe("NC.route", () => {
  it("eigengenutzt+halten hides AfA/RND", () => {
    const fx = loadFixture("eigengenutzt-halten.json");
    const r = NC.route(fx.facts, ruleset);
    assert.equal(r.cards.afa, false);
    assert.equal(r.cards.rnd, false);
    assert.equal(r.handoff.rnd, false);
    assert.equal(r.cards.ausweis, false);
    assertNoUserNd(r, assert);
  });

  it("suppress hides primary RND CTA and handoff RND", () => {
    const fx = loadFixture("etw-1966-mod-2019.json");
    const r = NC.route(fx.facts, ruleset);
    assert.equal(r.rndPosture, "suppress");
    assert.equal(r.rndCta.primary, false);
    assert.equal(r.rndCta.hidden, true);
    assert.equal(r.handoff.rnd, false);
    assert.equal(r.cards.rnd, true);
  });

  it("widen does not put RND on handoff strip", () => {
    const fx = loadFixture("modern-unbekannt-1966.json");
    const r = NC.route(fx.facts, ruleset);
    assert.equal(r.rndPosture, "widen");
    assert.equal(r.handoff.rnd, false);
    assert.equal(r.rndCta.primary, false);
    assert.equal(r.rndCta.secondaryText, true);
    assert.equal(r.cards.rnd, true);
  });

  it("primary puts RND on handoff", () => {
    const fx = loadFixture("etw-1966-unmod-vermiet.json");
    const r = NC.route(fx.facts, ruleset);
    assert.equal(r.rndPosture, "primary");
    assert.equal(r.handoff.rnd, true);
    assert.equal(r.rndCta.primary, true);
    assert.equal(r.version, ruleset.version);
    assert.equal(r.stand, ruleset.stand);
  });

  it("year unknown: AfA card ok, RND card hidden", () => {
    const fx = loadFixture("year-unknown.json");
    const r = NC.route(fx.facts, ruleset);
    assert.equal(r.cards.afa, true);
    assert.equal(r.cards.rnd, false);
    assert.equal(r.handoff.rnd, false);
    assert.equal(r.afa.blocked, "fertigstellung_unbekannt");
  });

  it("kaufen shows KPA without inventing split", () => {
    const fx = loadFixture("kpa-no-plz.json");
    const r = NC.route(fx.facts, ruleset);
    assert.equal(r.cards.kpa, true);
    assert.equal(r.gebaeudeanteilEur, null);
    assert.ok(r.scenarios.length > 0);
    assert.equal(r.scenarios[0].mehrAfa, undefined);
  });

  it("gemischt uses single Gebäudeanteil", () => {
    const fx = loadFixture("gemischt-single-anteil.json");
    const r = NC.route(fx.facts, ruleset);
    assert.equal(r.cards.afa, true);
    assert.equal(r.gebaeudeanteilEur, 150000);
    const nd30 = r.scenarios.find((s) => s.id === "nd30");
    assert.equal(nd30.mehrAfa.mehrAfaEur, 2000);
  });

  it("vermiet vs eigengenutzt changes cards", () => {
    const base = {
      anlass: "halten",
      fertigstellungJahr: 1966,
      modernisierung: "keine",
      ausweis: "vorhanden",
    };
    const v = NC.route({ ...base, nutzung: "vermieter_wohnen" }, ruleset);
    const e = NC.route({ ...base, nutzung: "eigengenutzt" }, ruleset);
    assert.equal(v.cards.afa, true);
    assert.equal(e.cards.afa, false);
    assert.equal(v.cards.rnd, true);
    assert.equal(e.cards.rnd, false);
  });

  it("umfassend without year: widen, no handoff RND", () => {
    const fx = loadFixture("umfassend-jahr-unbekannt.json");
    const r = NC.route(fx.facts, ruleset);
    assert.equal(r.rndPosture, "widen");
    assert.equal(r.rndReasons.length, 1);
    assert.equal(r.rndReasons[0], "umfassend_jahr_unbekannt");
    assert.equal(r.handoff.rnd, false);
    assert.equal(r.rndCta.primary, false);
  });

  it("version stamp only from ruleset", () => {
    const r = NC.route(
      {
        anlass: "halten",
        nutzung: "vermieter_wohnen",
        fertigstellungJahr: 1966,
        modernisierung: "keine",
      },
      ruleset
    );
    assert.equal(r.version, "2026.09.1");
    assert.equal(r.stand, "2026-09-15");
  });
});
