import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// js/app.js is DOM-bound and this repo has no runtime dependencies, so these
// are source-contract checks. Behaviour in a real browser is covered by the
// manual packed-file walkthrough in the definition of done.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(root, "js/app.js"), "utf8");
const copy = JSON.parse(readFileSync(join(root, "config/copy.de.json"), "utf8"));

describe("unlock machine", () => {
  it("drives all three phases on #main", () => {
    assert.match(app, /\$\("main"\)\.setAttribute\("data-phase", "start"\)/);
    assert.match(app, /\$\("main"\)\.setAttribute\("data-phase", phase\)/);
    assert.match(app, /var phase = showInsight \? "insight" : "context"/);
  });

  it("gates beat 2 and beat 4 on a known year", () => {
    assert.match(app, /setHidden\("mod-group", !\(afaPath && haveYear\)\)/);
    assert.match(app, /setHidden\("ausweis-block", afaPath && !haveYear\)/);
    assert.match(app, /setHidden\("q4-zahlen", !\(afaPath && showInsight\)\)/);
  });

  it("requires a finite integer year", () => {
    assert.match(app, /Number\.isFinite\(y\) && y === Math\.trunc\(y\)/);
  });

  it("opens the two expanders only on the AfA paths", () => {
    assert.match(app, /setHidden\("rechenbeispiele", !\(afaPath && showInsight\)\)/);
    assert.match(app, /setHidden\("gutachter-details", !\(afaPath && showInsight\)\)/);
  });

  it("collapses beat 0 once the insight is open", () => {
    assert.match(app, /setBeatOpen\("q1-role", !showInsight\)/);
    assert.match(app, /setHidden\("role-grid", showInsight\)/);
  });
});

describe("facts reading", () => {
  it("takes gutachtenVorhanden as a strict boolean from the checkbox", () => {
    assert.match(app, /gutachten\.checked === true/);
    assert.equal(
      /gutachtenVorhanden[\s\S]{0,200}"true"/.test(app),
      false,
      "must never accept the string \"true\""
    );
    assert.match(app, /facts\.gutachtenVorhanden = true;/);
  });
});

describe("Q3 render", () => {
  it("renders no tile grid at all", () => {
    for (const dead of [
      "tileShell",
      'class="tiles"',
      'class="tile"',
      "data-expand",
      "state.expanded",
      "defaultExpanded",
    ]) {
      assert.equal(app.includes(dead), false, `${dead} must be gone`);
    }
  });

  it("Lagebild uses all four beats plus the posture body", () => {
    for (const key of [
      "lagebild.beat1",
      "lagebild.beat2",
      "lagebild.beat3",
      "lagebild.beat4",
      "posture.lead",
    ]) {
      assert.ok(app.includes(`"${key}"`), `${key} must be rendered`);
    }
    assert.match(app, /posture\.body\.pruefen/);
    assert.match(app, /posture\.body\.unsicher/);
    assert.match(app, /posture\.body\.unwirtschaftlich/);
    assert.match(app, /\{satzPct\}/);
    assert.match(app, /\{ndJahre\}/);
  });

  it("routes non-AfA rollen to a role lesson instead", () => {
    assert.match(app, /renderRoleLesson/);
    const lesson = app.slice(
      app.indexOf("function renderRoleLesson"),
      app.indexOf("function renderScenarioTable")
    );
    assert.equal(lesson.includes("lagebild.beat"), false);
    assert.equal(lesson.includes("scenarios"), false);
    for (const key of ["lesson.mieter", "lesson.verkaeufer", "lesson.kaeufer_eigen"]) {
      assert.ok(lesson.includes(key), `${key} must be used`);
    }
  });

  it("puts the scenario table inside the Rechenbeispiele body", () => {
    assert.match(
      app,
      /\$\("rechenbeispiele-body"\)\.innerHTML = renderRechenbeispieleBody\(routed\)/
    );
    assert.match(app, /function renderRechenbeispieleBody[\s\S]{0,80}renderScenarioTable/);
  });

  it("guards the rendered output against all eight forbidden strings", () => {
    const list = app.slice(app.indexOf("var FORBIDDEN"), app.indexOf("function $("));
    for (const needle of [
      "Ihre Restnutzungsdauer",
      "landet bei",
      "typischerweise 20–30",
      "Anerkennungsquote",
      "Steuerspar-Garantie",
      "gute Erfolgsaussicht",
      "Optimierung",
      "Garantierte",
    ]) {
      assert.ok(list.includes(needle), `${needle} must be guarded`);
    }
    assert.match(app, /assertNoForbidden\(\s*\(\$\("q3-body"\)\.textContent/);
  });
});

describe("euro columns and CTAs", () => {
  it("unlocks Steuer-Cash and Amort only when the inputs are set", () => {
    assert.match(app, /showTax = showMehr && routed\.grenzsatzPct != null/);
    assert.match(app, /showAmort = showTax && routed\.honorarEur != null/);
  });

  it("never gives Mieter a hero button", () => {
    assert.match(app, /rolle === "mieter"[\s\S]{0,120}cta\.ausweisText", "text"/);
  });

  it("keeps suppress link-free and widen text-only", () => {
    assert.match(app, /routed\.rndCta && routed\.rndCta\.primary/);
    assert.match(app, /routed\.rndCta\.secondaryText[\s\S]{0,120}"cta\.rndSecondary", "text"/);
    assert.equal(
      /"cta\.rndSecondary",\s*"button"/.test(app),
      false,
      "the secondary RND exit must never be a button"
    );
  });
});

describe("reset and print", () => {
  it("resetRole clears every answer and closes the expanders", () => {
    const reset = app.slice(
      app.indexOf("function resetRole"),
      app.indexOf("function selectRole")
    );
    for (const id of [
      "fertigstellungJahr",
      "modernisierungJahr",
      "gutachtenVorhanden",
      "gebaeudeanteilEur",
      "kaufpreisEur",
      "splitPct",
      "grenzsatzPct",
      "honorarEur",
      "splitPctA",
      "splitPctB",
    ]) {
      assert.ok(reset.includes(id), `${id} must be cleared`);
    }
    for (const d of ["zahlen-details", "rechenbeispiele", "gutachter-details"]) {
      assert.ok(reset.includes(`closeDetails("${d}")`), `${d} must be closed`);
    }
    assert.match(reset, /"data-phase", "start"/);
    assert.match(reset, /gutachten\.checked = false/);
  });

  it("opens details for print and restores afterwards", () => {
    assert.match(app, /addEventListener\("beforeprint"/);
    assert.match(app, /addEventListener\("afterprint"/);
    assert.match(app, /all\[i\]\.open = true/);
    assert.match(app, /restore\[i\]\.el\.open = restore\[i\]\.open/);
  });
});

describe("chrome", () => {
  it("fills the brand from product.name and binds copy at boot", () => {
    assert.match(app, /\$\("brand"\)\.textContent = name/);
    assert.match(app, /var name = t\("product\.name"\)/);
    assert.match(app, /renderChrome\(\);\s*\n\s*bindUi\(\);/);
    assert.match(app, /applyCopyBindings\(\)/);
  });

  it("keeps the liability sentence in footer-meta", () => {
    assert.match(app, /footer-meta"\)\.textContent =[\s\S]{0,240}legal\.keineSteuerberatung/);
    assert.ok(copy["footer.disclaimer"].includes("Keine Steuerberatung"));
  });

  it("every copy key app.js asks for exists", () => {
    const keys = [...app.matchAll(/\bt\("([a-z][a-zA-Z0-9_.]+)"\)/g)].map((m) => m[1]);
    const dynamic = new Set(["role.", "glossary."]);
    const missing = keys.filter(
      (k) => !(k in copy) && ![...dynamic].some((p) => k.startsWith(p))
    );
    assert.deepEqual([...new Set(missing)], []);
  });
});
