import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadNC, loadRuleset, loadFixture } from "./load.mjs";

const NC = loadNC();
const ruleset = loadRuleset();

describe("steuerCash", () => {
  it("computes eurJahr from Mehr-AfA × Grenzsatz", () => {
    const r = NC.steuerCash(2000, 42);
    assert.equal(r.modell, true);
    assert.equal(r.eurJahr, 840);
  });

  it("empty grenzsatz ⇒ ratesOnly, no euro", () => {
    const r = NC.steuerCash(2000, null);
    assert.equal(r.ratesOnly, true);
    assert.equal(r.eurJahr, undefined);
  });

  it("missing mehrAfa ⇒ ratesOnly", () => {
    const r = NC.steuerCash(null, 42);
    assert.equal(r.ratesOnly, true);
  });
});

describe("amortJahre", () => {
  it("honorar / steuerCash", () => {
    const r = NC.amortJahre(900, 840);
    assert.equal(r.modell, true);
    assert.ok(Math.abs(r.jahre - 900 / 840) < 1e-9);
  });

  it("missing honorar ⇒ ratesOnly", () => {
    const r = NC.amortJahre(null, 840);
    assert.equal(r.ratesOnly, true);
  });

  it("non-positive cash ⇒ ratesOnly", () => {
    const r = NC.amortJahre(900, 0);
    assert.equal(r.ratesOnly, true);
  });
});

describe("route optional cash columns", () => {
  it("empty grenzsatz ⇒ no euro tax on scenarios", () => {
    const fx = loadFixture("etw-1966-unmod-vermiet.json");
    const r = NC.route(fx.facts, ruleset);
    const nd30 = r.scenarios.find((s) => s.id === "nd30");
    assert.ok(nd30.mehrAfa);
    assert.equal(nd30.mehrAfa.mehrAfaEur, 2000);
    assert.equal(nd30.steuerCash.ratesOnly, true);
    assert.equal(nd30.steuerCash.eurJahr, undefined);
  });

  it("with grenzsatz + honorar attaches steuer and amort", () => {
    const fx = loadFixture("etw-1966-unmod-vermiet.json");
    const facts = Object.assign({}, fx.facts, {
      grenzsatzPct: 42,
      honorarEur: 900,
    });
    const r = NC.route(facts, ruleset);
    const nd30 = r.scenarios.find((s) => s.id === "nd30");
    assert.equal(nd30.steuerCash.eurJahr, 840);
    assert.ok(Math.abs(nd30.amort.jahre - 900 / 840) < 1e-9);
  });

  it("kpaCompare only when A and B set by user", () => {
    const none = NC.route(
      {
        anlass: "kaufen",
        nutzung: "vermieter_wohnen",
        fertigstellungJahr: 1966,
        modernisierung: "keine",
        kaufpreisEur: 400000,
      },
      ruleset
    );
    assert.equal(none.kpaCompare, null);

    const both = NC.route(
      {
        anlass: "kaufen",
        nutzung: "vermieter_wohnen",
        fertigstellungJahr: 1966,
        modernisierung: "keine",
        kaufpreisEur: 400000,
        splitPctA: 60,
        splitPctB: 40,
      },
      ruleset
    );
    assert.equal(both.kpaCompare.a.gebaeudeanteilEur, 240000);
    assert.equal(both.kpaCompare.b.gebaeudeanteilEur, 160000);
    assert.equal(both.kpaCompare.a.afaGesetzlichEur, 4800);
    assert.equal(both.kpaCompare.b.afaGesetzlichEur, 3200);
  });
});
