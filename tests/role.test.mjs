import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadNC, loadRuleset, loadFixture } from "./load.mjs";

const NC = loadNC();
const ruleset = loadRuleset();

describe("rolle mapping", () => {
  it("mieter hides AfA/RND/KPA, shows Ausweis only", () => {
    const fx = loadFixture("rolle-mieter.json");
    const r = NC.route(fx.facts, ruleset);
    assert.equal(r.rolle, "mieter");
    assert.equal(r.cards.afa, false);
    assert.equal(r.cards.rnd, false);
    assert.equal(r.cards.kpa, false);
    assert.equal(r.cards.ausweis, true);
    assert.equal(r.handoff.rnd, false);
    assert.equal(r.handoff.kpa, false);
    assert.equal(r.rndCta.primary, false);
  });

  it("kaeufer_eigen hides RND", () => {
    const fx = loadFixture("rolle-kaeufer-eigen.json");
    const r = NC.route(fx.facts, ruleset);
    assert.equal(r.rolle, "kaeufer_eigen");
    assert.equal(r.cards.rnd, false);
    assert.equal(r.cards.afa, false);
    assert.equal(r.rndCta.primary, false);
    assert.equal(r.cards.ausweis, true);
  });

  it("vermieter 1966 keine still primary", () => {
    const fx = loadFixture("rolle-vermieter-1966.json");
    const r = NC.route(fx.facts, ruleset);
    assert.equal(r.rolle, "vermieter");
    assert.equal(r.rndPosture, "primary");
    assert.equal(r.cards.afa, true);
    assert.equal(r.cards.rnd, true);
    assert.equal(r.rndCta.primary, true);
    assert.equal(r.handoff.rnd, true);
    const nd30 = r.scenarios.find((s) => s.id === "nd30");
    assert.equal(nd30.mehrAfa.mehrAfaEur, 2000);
  });

  it("applyRolle maps kaeufer_vermiet", () => {
    const f = NC.applyRolle({ rolle: "kaeufer_vermiet" });
    assert.equal(f.anlass, "kaufen");
    assert.equal(f.nutzung, "vermieter_wohnen");
  });

  it("applyRolle maps verkaeufer", () => {
    const f = NC.applyRolle({ rolle: "verkaeufer" });
    assert.equal(f.anlass, "verkauf");
  });
});
