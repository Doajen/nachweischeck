import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const copy = JSON.parse(readFileSync(join(root, "config/copy.de.json"), "utf8"));

function indexOfId(id) {
  const at = html.indexOf(`id="${id}"`);
  assert.notEqual(at, -1, `#${id} must exist`);
  return at;
}

describe("beat shell", () => {
  it("has no ghost panes left", () => {
    assert.equal(html.includes("data-placeholder"), false);
    assert.equal(html.includes("Wird freigeschaltet"), false);
    assert.equal(html.includes("quad"), false);
  });

  it("has no tile grid markup", () => {
    assert.equal(html.includes('class="tiles"'), false);
    assert.equal(html.includes('class="tile"'), false);
  });

  it("carries the new beat 2 and beat 3 containers, closed", () => {
    for (const id of [
      "mod-group",
      "gutachten-chip",
      "rechenbeispiele",
      "gutachter-details",
      "q4-zahlen",
    ]) {
      indexOfId(id);
    }
    assert.equal(/<details id="rechenbeispiele"[^>]*\sopen/.test(html), false);
    assert.equal(/<details id="gutachter-details"[^>]*\sopen/.test(html), false);
  });

  it("the Gutachten chip is a checkbox named gutachtenVorhanden", () => {
    assert.match(
      html,
      /<input type="checkbox" id="gutachtenVorhanden" name="gutachtenVorhanden">/
    );
  });

  it("Zahlen left Q2 and sits after Q3 inside the form", () => {
    const form = html.indexOf('id="gate-form"');
    const formEnd = html.indexOf("</form>");
    const zahlen = indexOfId("q4-zahlen");
    assert.ok(zahlen > form && zahlen < formEnd, "q4-zahlen stays inside the form");
    assert.ok(zahlen > indexOfId("q3-insight"), "q4-zahlen comes after q3-insight");
    assert.ok(zahlen < indexOfId("q4-next"), "q4-zahlen comes before the CTA beat");

    const q2 = html.slice(indexOfId("q2-context"), indexOfId("q3-insight"));
    assert.equal(q2.includes("zahlen-details"), false, "Q2 no longer holds Zahlen");
  });
});

describe("copy bindings", () => {
  it("every bound key exists in copy.de.json", () => {
    const attrs = ["data-copy", "data-copy-placeholder", "data-copy-aria"];
    const missing = [];
    for (const attr of attrs) {
      const re = new RegExp(`${attr}="([^"]+)"`, "g");
      for (const m of html.matchAll(re)) {
        if (!(m[1] in copy)) missing.push(`${attr}=${m[1]}`);
      }
    }
    assert.deepEqual(missing, []);
  });

  it("binds at least the first-screen question and role subtitles", () => {
    for (const key of [
      "q1.title",
      "role.vermieter",
      "role.vermieter.sub",
      "role.kaufen",
      "role.mieter",
      "role.mieter.sub",
      "gutachten.label",
      "q3.rechenbeispiele",
      "gutachter.title",
      "zahlen.summary",
    ]) {
      assert.ok(html.includes(`data-copy="${key}"`), `${key} must be bound`);
    }
  });
});

describe("pack.mjs rewrite targets stay intact", () => {
  it("the stylesheet link is byte-identical", () => {
    assert.ok(html.includes('<link rel="stylesheet" href="css/app.css">'));
    assert.match(html, /<link rel="stylesheet" href="css\/app\.css">\s*/);
  });

  it("the five script tags still match the packer regex", () => {
    const packerRe =
      /\s*<script src="js\/calc\.js"><\/script>\s*<script src="js\/route\.js"><\/script>\s*<script src="js\/affiliates\.js"><\/script>\s*<script src="js\/skin\.js"><\/script>\s*<script src="js\/app\.js"><\/script>\s*/;
    assert.match(html, packerRe);
  });
});
