import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function runPack(args = []) {
  return execFileSync(process.execPath, ["scripts/pack.mjs", ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function packFails(args) {
  try {
    runPack(args);
    return null;
  } catch (err) {
    return String(err.stderr || err.message);
  }
}

const dist = {
  kanzlei: () => readFileSync(join(root, "dist/kanzlei/nachweischeck.html"), "utf8"),
  webHtml: () => readFileSync(join(root, "dist/web/index.html"), "utf8"),
  webJs: () => readFileSync(join(root, "dist/web/app.js"), "utf8"),
};

describe("default pack bakes no Kanzlei name", () => {
  before(() => runPack());
  // Leave the tree holding the default artifacts, not the demo skin.
  after(() => runPack());

  it("says so on stdout", () => {
    assert.match(runPack(), /skin: none/);
  });

  it("assigns no __NC_SKIN__ global", () => {
    assert.equal(/window\.__NC_SKIN__\s*=/.test(dist.kanzlei()), false);
    assert.equal(/window\.__NC_SKIN__\s*=/.test(dist.webJs()), false);
  });

  it("contains no placeholder firm name anywhere", () => {
    for (const artifact of [dist.kanzlei(), dist.webJs(), dist.webHtml()]) {
      assert.equal(artifact.includes("Muster Kanzlei"), false);
    }
  });

  it("still bakes ruleset, copy and affiliates", () => {
    const k = dist.kanzlei();
    for (const g of ["__NC_RULESET__", "__NC_COPY__", "__NC_AFFILIATES__"]) {
      assert.ok(k.includes("window." + g + " = "), g + " must be baked");
    }
  });
});

describe("--skin is opt-in", () => {
  after(() => runPack());

  it("bakes the example skin only when asked", () => {
    const out = runPack(["--skin"]);
    assert.match(out, /skin baked: skins\/kanzlei\.example\.json/);
    const k = dist.kanzlei();
    assert.match(k, /window\.__NC_SKIN__\s*=/);
    assert.ok(k.includes("Muster Kanzlei"));
  });

  it("accepts an explicit path", () => {
    assert.match(
      runPack(["--skin=skins/kanzlei.example.json"]),
      /skin baked: skins\/kanzlei\.example\.json/
    );
  });

  it("rejects an empty path and unknown flags", () => {
    assert.match(packFails(["--skin="]), /--skin= needs a path/);
    assert.match(packFails(["--bogus"]), /Unknown flag: --bogus/);
  });
});

describe("artifact shape", () => {
  before(() => runPack());

  it("dist/kanzlei is a genuine single file", () => {
    const k = dist.kanzlei();
    assert.equal(/<script src=/.test(k), false);
    assert.equal(/<link rel="stylesheet"/.test(k), false);
    assert.ok(k.includes("<style>"));
  });

  it("dist/web keeps flat siblings", () => {
    const h = dist.webHtml();
    assert.ok(h.includes('href="app.css"'));
    assert.ok(h.includes('<script src="app.js"></script>'));
    assert.equal(h.includes("css/app.css"), false);
    assert.ok(existsSync(join(root, "dist/web/app.css")));
    assert.ok(existsSync(join(root, "dist/web/app.js")));
  });

  it("escapes anything that could close the inlined script", () => {
    // Inside the baked JSON a literal </script> would end the block early.
    const inlined = dist.kanzlei().split("<script>")[1] || "";
    const bakedJson = inlined.split("window.__NC_AFFILIATES__")[0];
    assert.ok(bakedJson.length > 1000, "the baked globals should be substantial");
    assert.equal(bakedJson.includes("</script>"), false);
  });
});

describe("pack refuses silent no-op rewrites", () => {
  it("guards both index.html rewrite targets", () => {
    const src = readFileSync(join(root, "scripts/pack.mjs"), "utf8");
    assert.match(src, /pack rewrite did not change index\.html/);
    assert.ok(src.includes("replaceOnce"));
    const calls = src.match(/replaceOnce\(/g) || [];
    assert.ok(calls.length >= 4, "both artifacts assert both rewrites");
  });
});

describe("operator docs match the product promises", () => {
  const kanzlei = readFileSync(join(root, "docs/KANZLEI.md"), "utf8");
  const gtm = readFileSync(join(root, "docs/GTM.md"), "utf8");
  const ruleset = readFileSync(join(root, "docs/RULESET.md"), "utf8");

  it("KANZLEI.md covers name, Werbung, provision, updates and print", () => {
    for (const needle of [
      "?name=",
      "Anzeige / Werbung",
      "nicht der Kanzlei",
      "neue HTML-Datei",
      "Gesprächs",
      "kein Nachweis",
    ]) {
      assert.ok(kanzlei.includes(needle), `KANZLEI.md must mention ${needle}`);
    }
  });

  it("GTM.md names the channel, the affiliate step and the Impressum gate", () => {
    for (const needle of ["affiliates.json", "PLATZHALTER", "commission"]) {
      assert.ok(gtm.includes(needle), `GTM.md must mention ${needle}`);
    }
    assert.match(gtm, /\*\*Not Kleinanzeigen\.\*\*/);
    assert.match(gtm, /Kanzlei receives \*\*no\*\* commission/);
  });

  it("RULESET.md documents the opt-in skin", () => {
    assert.ok(ruleset.includes("--skin"));
    assert.match(ruleset, /not.{0,20}baked by default/i);
  });
});
