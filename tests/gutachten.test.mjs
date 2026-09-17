import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadNC, loadRuleset, loadFixture, assertNoUserNd } from "./load.mjs";

const NC = loadNC();
const ruleset = loadRuleset();

describe("gutachtenVorhanden suppresses the RND posture", () => {
  it("posture is suppress with the gutachten_vorhanden reason", () => {
    const fx = loadFixture("gutachten-vorhanden.json");
    const p = NC.rndPosture(fx.facts, ruleset);
    assert.equal(p.posture, "suppress");
    assert.ok(p.reasons.includes("gutachten_vorhanden"));
  });

  it("route hides every RND exit", () => {
    const fx = loadFixture("gutachten-vorhanden.json");
    const r = NC.route(fx.facts, ruleset);
    assert.equal(r.rndPosture, "suppress");
    assert.ok(r.rndReasons.includes("gutachten_vorhanden"));
    assert.equal(r.rndCta.primary, false);
    assert.equal(r.rndCta.secondaryText, false);
    assert.equal(r.rndCta.hidden, true);
    assert.equal(r.handoff.rnd, false);
  });

  it("scenarios stay named Rechenbeispiele, never a user ND", () => {
    const fx = loadFixture("gutachten-vorhanden.json");
    const r = NC.route(fx.facts, ruleset);
    assertNoUserNd(r, assert);
    for (const sc of r.scenarios) {
      assert.equal(sc.ndJahre, ruleset.rndScenarios.find((s) => s.id === sc.id).ndJahre);
      assert.ok(sc.label.startsWith("Szenario ND"));
      assert.equal(sc.modell, true);
    }
  });

  it("overrides a posture that would otherwise be primary", () => {
    const base = loadFixture("rolle-vermieter-1966.json").facts;
    assert.equal(NC.rndPosture(base, ruleset).posture, "primary");
    assert.equal(
      NC.rndPosture({ ...base, gutachtenVorhanden: true }, ruleset).posture,
      "suppress"
    );
  });

  it("only the exact boolean true suppresses", () => {
    const base = loadFixture("rolle-vermieter-1966.json").facts;
    for (const value of [undefined, false, null, "", "true", 1]) {
      assert.equal(
        NC.rndPosture({ ...base, gutachtenVorhanden: value }, ruleset).posture,
        "primary",
        `gutachtenVorhanden=${JSON.stringify(value)} must not suppress`
      );
    }
  });

  it("does not invent a rate or drop the statutory AfA row", () => {
    const fx = loadFixture("gutachten-vorhanden.json");
    const r = NC.route(fx.facts, ruleset);
    assert.equal(r.cards.afa, true);
    assert.equal(r.afa.satzPct, 2);
    assert.equal(r.afa.gesetzlicheNdJahre, 50);
  });
});
