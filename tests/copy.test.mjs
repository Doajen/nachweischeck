import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadNC, loadRuleset, loadFixture } from "./load.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const copy = JSON.parse(
  readFileSync(join(root, "config/copy.de.json"), "utf8")
);
const NC = loadNC();
const ruleset = loadRuleset();

const FORBIDDEN = [
  "Ihre Restnutzungsdauer",
  "Anerkennungsquote",
  "Steuerspar-Garantie",
];

function assertClean(text) {
  for (const needle of FORBIDDEN) {
    assert.equal(
      text.includes(needle),
      false,
      `forbidden string present: ${needle}`
    );
  }
}

describe("forbidden copy strings", () => {
  it("copy.de.json has none of the forbidden phrases", () => {
    assertClean(JSON.stringify(copy));
  });

  it("serialized results fixture text has none", () => {
    const fx = loadFixture("etw-1966-unmod-vermiet.json");
    const routed = NC.route(fx.facts, ruleset);
    // Mimic UI serialization: scenario labels + legal copy, never diagnosed ND.
    const parts = [
      copy["product.name"],
      copy["footer.disclaimer"],
      copy["rnd.rechtslage"],
      copy["rnd.unwirtschaftlich"],
      copy["rnd.widenNote"],
      copy["kpa.arbeitshilfeVsGutachten"],
      copy["legal.keineSteuerberatung"],
      `Ruleset ${routed.version} Stand ${routed.stand}`,
      `Gesetzlicher Satz ${routed.afa.satzPct} %`,
    ];
    for (const sc of routed.scenarios) {
      parts.push(sc.label);
      if (sc.mehrAfa && !sc.mehrAfa.ratesOnly) {
        parts.push(`Mehr-AfA ${sc.mehrAfa.mehrAfaEur} €/Jahr (Modellrechnung)`);
      }
    }
    const suppressFx = loadFixture("etw-1966-mod-2019.json");
    const suppressRouted = NC.route(suppressFx.facts, ruleset);
    parts.push(copy["rnd.unwirtschaftlich"]);
    parts.push(`posture:${suppressRouted.rndPosture}`);

    const widenFx = loadFixture("umfassend-jahr-unbekannt.json");
    const widenRouted = NC.route(widenFx.facts, ruleset);
    parts.push(copy["rnd.widenNote"]);
    parts.push(`posture:${widenRouted.rndPosture}`);

    assertClean(parts.join("\n"));
  });
});
