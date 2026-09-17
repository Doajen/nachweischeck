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
  "landet bei",
  "typischerweise 20–30",
  "Anerkennungsquote",
  "Steuerspar-Garantie",
  "gute Erfolgsaussicht",
  "Optimierung",
  "Garantierte",
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

function buildLagebild(routed) {
  const beat1 = copy["lagebild.beat1"]
    .replace("{satzPct}", String(routed.afa.satzPct).replace(".", ","))
    .replace("{ndJahre}", String(routed.afa.gesetzlicheNdJahre));
  let postureBody = copy["posture.body.pruefen"];
  if (routed.rndPosture === "widen") postureBody = copy["posture.body.unsicher"];
  if (routed.rndPosture === "suppress")
    postureBody = copy["posture.body.unwirtschaftlich"];
  return [
    beat1,
    copy["lagebild.beat2"],
    copy["lagebild.beat3"],
    copy["lagebild.beat4"],
    copy["posture.lead"],
    postureBody,
    copy["posture.pruefen"],
    copy["posture.unsicher"],
    copy["posture.unwirtschaftlich"],
  ].join("\n");
}

describe("forbidden copy strings", () => {
  it("copy.de.json has none of the forbidden phrases", () => {
    assertClean(JSON.stringify(copy));
  });

  it("Lagebild beats have no forbidden / predicted-ND strings", () => {
    const fx = loadFixture("rolle-vermieter-1966.json");
    const routed = NC.route(fx.facts, ruleset);
    assertClean(buildLagebild(routed));

    const suppressFx = loadFixture("etw-1966-mod-2019.json");
    suppressFx.facts.rolle = "vermieter";
    assertClean(buildLagebild(NC.route(suppressFx.facts, ruleset)));
  });

  it("serialized results fixture text has none", () => {
    const fx = loadFixture("etw-1966-unmod-vermiet.json");
    const routed = NC.route(fx.facts, ruleset);
    const parts = [
      copy["product.name"],
      copy["footer.disclaimer"],
      copy["rnd.rechtslage"],
      copy["rnd.unwirtschaftlich"],
      copy["rnd.widenNote"],
      copy["kpa.arbeitshilfeVsGutachten"],
      copy["legal.keineSteuerberatung"],
      copy["mieter.forward"],
      copy["lagebild.beat2"],
      copy["lagebild.beat3"],
      `Ruleset ${routed.version} Stand ${routed.stand}`,
      `Gesetzlicher Satz ${routed.afa.satzPct} %`,
    ];
    for (const sc of routed.scenarios) {
      parts.push(sc.label);
    }
    assertClean(parts.join("\n"));
  });

  it("glossary keys are one-breath and clean", () => {
    const keys = [
      "glossary.afa",
      "glossary.gesetzliche_groesse",
      "glossary.rnd",
      "glossary.nachweis",
      "glossary.szenario_nd",
      "glossary.gebaeudeanteil",
      "glossary.grenzsatz",
      "glossary.arbeitshilfe",
      "glossary.energieausweis",
      "glossary.modellrechnung",
    ];
    for (const k of keys) {
      assert.ok(copy[k] && copy[k].length > 10, k);
      assertClean(copy[k]);
    }
  });

  it("role subtitles and role lessons are educational and clean", () => {
    const keys = [
      "role.vermieter.sub",
      "role.kaufen.sub",
      "role.kaeufer_vermiet.sub",
      "role.kaeufer_eigen.sub",
      "role.verkaeufer.sub",
      "role.mieter.sub",
      "lesson.verkaeufer",
      "lesson.kaeufer_eigen",
      "lesson.mieter",
    ];
    for (const k of keys) {
      assert.ok(copy[k] && copy[k].length > 10, k);
      assertClean(copy[k]);
    }
  });
});

describe("copy / copyKeys parity", () => {
  it("every copyKeys entry exists in copy.de.json", () => {
    const missing = ruleset.copyKeys.filter((k) => !(k in copy));
    assert.deepEqual(missing, []);
  });

  it("every copy.de.json key is declared in copyKeys", () => {
    const declared = new Set(ruleset.copyKeys);
    const undeclared = Object.keys(copy).filter((k) => !declared.has(k));
    assert.deepEqual(undeclared, []);
  });

  it("removed keys stay removed", () => {
    for (const k of [
      "persist.label",
      "persist.clear",
      "datenschutz.optionalPersist",
      "quad.placeholder",
      "dashboard.empty",
      "lagebild.beat4.pruefen",
      "lagebild.beat4.unsicher",
      "lagebild.beat4.unwirtschaftlich",
      "tile.afa",
      "tile.rnd",
      "tile.kpa",
      "tile.ausweis",
    ]) {
      assert.equal(k in copy, false, `${k} must be gone from copy`);
      assert.equal(
        ruleset.copyKeys.includes(k),
        false,
        `${k} must be gone from copyKeys`
      );
    }
  });
});

describe("Lagebild beat 4 carries the withdrawn BMF reference", () => {
  it("names both BMF dates and the file number", () => {
    const beat4 = copy["lagebild.beat4"];
    assert.ok(beat4.includes("22.02.2023"), "cites the withdrawn Schreiben");
    assert.ok(beat4.includes("01.12.2025"), "cites the withdrawal");
    assert.ok(beat4.includes("IV C 3 – S 2196/00040/006/008"), "cites the Aktenzeichen");
    assert.ok(beat4.includes("ImmoWertV"), "separates valuation from tax ND");
    assertClean(beat4);
  });
});

describe("Slice G unlock expectations", () => {
  it("mieter still has no scenarios", () => {
    const r = NC.route(loadFixture("rolle-mieter.json").facts, ruleset);
    assert.equal(r.cards.rnd, false);
    assert.equal(r.scenarios.length, 0);
  });

  it("kaeufer_eigen does not open RND", () => {
    const r = NC.route(loadFixture("rolle-kaeufer-eigen.json").facts, ruleset);
    assert.equal(r.cards.rnd, false);
    assert.equal(r.cards.afa, false);
  });
});
