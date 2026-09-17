/**
 * The section 9 acceptance matrix in one readable place. Individual units are
 * covered elsewhere; this file exists so the release gate can be read top to
 * bottom without reconstructing it from six other files.
 *
 * Deliberately no browser here: the packed-artifact walkthrough is manual.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadNC, loadRuleset, loadFixture, assertNoUserNd } from "./load.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const NC = loadNC();
const ruleset = loadRuleset();
const copy = JSON.parse(readFileSync(join(root, "config/copy.de.json"), "utf8"));

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

const route = (name, patch) => {
  const facts = { ...loadFixture(name).facts, ...(patch || {}) };
  return NC.route(facts, ruleset);
};

describe("matrix: rollen that must never see AfA or ND", () => {
  it("mieter has no scenarios, no RND CTA and no hero button", () => {
    const r = route("rolle-mieter.json");
    assert.equal(r.cards.rnd, false);
    assert.equal(r.cards.afa, false);
    assert.equal(r.scenarios.length, 0);
    assert.equal(r.rndCta.primary, false);
    assert.equal(r.rndCta.secondaryText, false);
    assert.equal(r.rndCta.hidden, true);
    assert.equal(r.handoff.rnd, false);

    // The one exit a Mieter may see is rendered as a text link, never a button.
    const app = readFileSync(join(root, "js/app.js"), "utf8");
    assert.match(app, /rolle === "mieter"[\s\S]{0,120}cta\.ausweisText", "text"/);
  });

  it("kaeufer_eigen gets neither RND nor AfA", () => {
    const r = route("rolle-kaeufer-eigen.json");
    assert.equal(r.cards.rnd, false);
    assert.equal(r.cards.afa, false);
    assert.equal(r.rndCta.hidden, true);
    assert.equal(r.scenarios.length, 0);
  });
});

describe("matrix: posture per constellation", () => {
  it("1966 keine + 150000 → primary, ND 30 Mehr-AfA exactly 2000", () => {
    const r = route("rolle-vermieter-1966.json");
    assert.equal(r.rndPosture, "primary");
    assert.equal(r.rndCta.primary, true);
    assert.equal(r.afa.satzPct, 2);
    assert.equal(r.afa.gesetzlicheNdJahre, 50);
    assert.equal(r.gebaeudeanteilEur, 150000);
    const nd30 = r.scenarios.find((s) => s.id === "nd30");
    assert.equal(nd30.mehrAfa.mehrAfaEur, 2000);
  });

  it("1966 umfassend 2019 → suppress", () => {
    const r = route("etw-1966-mod-2019.json", { rolle: "vermieter" });
    assert.equal(r.rndPosture, "suppress");
    assert.equal(r.rndCta.primary, false);
    assert.equal(r.rndCta.hidden, true);
    assert.equal(r.handoff.rnd, false);
  });

  it("1966 modernisierung unbekannt → widen", () => {
    const r = route("modern-unbekannt-1966.json");
    assert.equal(r.rndPosture, "widen");
    assert.equal(r.rndCta.primary, false);
    assert.equal(r.rndCta.secondaryText, true);
    assert.equal(r.handoff.rnd, false);
  });

  it("umfassend without a year → widen", () => {
    const r = route("umfassend-jahr-unbekannt.json");
    assert.equal(r.rndPosture, "widen");
    assert.equal(r.handoff.rnd, false);
  });

  it("gutachtenVorhanden true → suppress", () => {
    const r = route("gutachten-vorhanden.json");
    assert.equal(r.rndPosture, "suppress");
    assert.ok(r.rndReasons.includes("gutachten_vorhanden"));
    assert.equal(r.rndCta.hidden, true);
  });
});

describe("matrix: euros only from the user's own inputs", () => {
  it("an empty Grenzsatz yields no Steuer-Cash euros", () => {
    const r = route("rolle-vermieter-1966.json");
    assert.equal(r.grenzsatzPct, null);
    for (const sc of r.scenarios) {
      assert.equal(sc.steuerCash.ratesOnly, true);
      assert.equal(sc.steuerCash.eurJahr, undefined);
      assert.equal(sc.amort.ratesOnly, true);
      assert.equal(sc.amort.jahre, undefined);
    }
  });

  it("a Grenzsatz unlocks cash but a missing Honorar still blocks Amortisation", () => {
    const r = route("rolle-vermieter-1966.json", { grenzsatzPct: 42 });
    const nd30 = r.scenarios.find((s) => s.id === "nd30");
    assert.equal(nd30.steuerCash.eurJahr, 840);
    assert.equal(nd30.amort.ratesOnly, true);
  });

  it("no route result ever names a user Nutzungsdauer", () => {
    for (const name of [
      "rolle-vermieter-1966.json",
      "modern-unbekannt-1966.json",
      "gutachten-vorhanden.json",
      "rolle-mieter.json",
    ]) {
      assertNoUserNd(route(name), assert);
    }
  });
});

describe("matrix: language gates", () => {
  function assertClean(text, where) {
    for (const needle of FORBIDDEN) {
      assert.equal(
        text.includes(needle),
        false,
        `${where} must not contain "${needle}"`
      );
    }
  }

  it("the whole copy file is clean of all eight strings", () => {
    assertClean(JSON.stringify(copy), "copy.de.json");
  });

  it("the rendered Lagebild surface is clean for every posture", () => {
    for (const name of [
      "rolle-vermieter-1966.json",
      "modern-unbekannt-1966.json",
      "gutachten-vorhanden.json",
    ]) {
      const r = route(name);
      const beat1 = copy["lagebild.beat1"]
        .replace("{satzPct}", String(r.afa.satzPct).replace(".", ","))
        .replace("{ndJahre}", String(r.afa.gesetzlicheNdJahre));
      const postureBody = {
        primary: copy["posture.body.pruefen"],
        widen: copy["posture.body.unsicher"],
        suppress: copy["posture.body.unwirtschaftlich"],
      }[r.rndPosture];
      const rendered = [
        copy["lagebild.title"],
        copy["modell.caption"],
        beat1,
        copy["lagebild.beat2"],
        copy["lagebild.beat3"],
        copy["lagebild.beat4"],
        copy["posture.lead"],
        postureBody,
        copy["rnd.rechtslage"],
        copy["deg5a.outOfScope"],
        copy["scope.outOfScope"],
        ...r.scenarios.map((s) => s.label),
      ].join("\n");
      assertClean(rendered, `Lagebild for ${name}`);
    }
  });

  it("all ten glossary entries are clean and non-empty", () => {
    const terms = [
      "afa",
      "gesetzliche_groesse",
      "rnd",
      "nachweis",
      "szenario_nd",
      "gebaeudeanteil",
      "grenzsatz",
      "arbeitshilfe",
      "energieausweis",
      "modellrechnung",
    ];
    assert.equal(terms.length, 10);
    for (const term of terms) {
      const value = copy["glossary." + term];
      assert.ok(value && value.length > 10, term);
      assertClean(value, "glossary." + term);
    }
  });
});

describe("matrix: artifact gates", () => {
  it("index.html has no ghost panes", () => {
    const html = readFileSync(join(root, "index.html"), "utf8");
    assert.equal(html.includes("data-placeholder"), false);
    assert.equal(html.includes("Wird freigeschaltet"), false);
  });

  it("the default packed artifacts carry no placeholder firm name", () => {
    execFileSync(process.execPath, ["scripts/pack.mjs"], { cwd: root, encoding: "utf8" });
    for (const rel of [
      "dist/kanzlei/nachweischeck.html",
      "dist/web/index.html",
      "dist/web/app.js",
    ]) {
      const artifact = readFileSync(join(root, rel), "utf8");
      assert.equal(artifact.includes("Muster Kanzlei"), false, rel);
      assert.equal(/window\.__NC_SKIN__\s*=/.test(artifact), false, rel);
    }
  });
});
