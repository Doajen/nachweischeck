#!/usr/bin/env node
/**
 * Zero-deps packer: bake JSON into window globals for dist/web and dist/kanzlei.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

/** Escape so inlined JSON cannot close a <script> tag. */
function safeJsonInline(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function assertCopyKeys(ruleset, copy) {
  const keys = ruleset.copyKeys || [];
  const missing = keys.filter((k) => !(k in copy));
  if (missing.length) {
    throw new Error("Missing copyKeys in copy.de.json: " + missing.join(", "));
  }
}

function assertSkinClean(rel) {
  const skin = readJson(rel);
  const banned = ["affiliate", "affiliates", "id", "urlTemplate", "rnd", "kpa", "ausweis"];
  const bad = banned.filter((k) => Object.prototype.hasOwnProperty.call(skin, k));
  if (bad.length) {
    throw new Error(rel + " must not contain affiliate keys: " + bad.join(", "));
  }
}

function bakeGlobals(ruleset, copy, affiliates, skin) {
  let js =
    "window.__NC_RULESET__ = " +
    safeJsonInline(ruleset) +
    ";\n" +
    "window.__NC_COPY__ = " +
    safeJsonInline(copy) +
    ";\n" +
    "window.__NC_AFFILIATES__ = " +
    safeJsonInline(affiliates) +
    ";\n";
  if (skin) {
    js += "window.__NC_SKIN__ = " + safeJsonInline(skin) + ";\n";
  }
  return js;
}

function concatAppJs(bake) {
  const files = [
    "js/calc.js",
    "js/route.js",
    "js/affiliates.js",
    "js/skin.js",
    "js/app.js",
  ];
  return bake + "\n" + files.map((f) => read(f)).join("\n");
}

function htmlWithInlineCssJs(css, js, singleFile) {
  let html = read("index.html");
  // Drop external stylesheet + script tags; inject inline.
  html = html.replace(
    /<link rel="stylesheet" href="css\/app\.css">\s*/,
    singleFile ? "<style>\n" + css + "\n</style>\n" : '<link rel="stylesheet" href="app.css">\n'
  );
  html = html.replace(
    /\s*<script src="js\/calc\.js"><\/script>\s*<script src="js\/route\.js"><\/script>\s*<script src="js\/affiliates\.js"><\/script>\s*<script src="js\/skin\.js"><\/script>\s*<script src="js\/app\.js"><\/script>\s*/,
    "\n  <script>\n" + js + "\n  </script>\n"
  );
  return html;
}

function pack() {
  const ruleset = readJson("rulesets/current.json");
  const copy = readJson("config/copy.de.json");
  const affiliates = readJson("config/affiliates.json");
  assertCopyKeys(ruleset, copy);

  const skinsDir = join(root, "skins");
  for (const name of readdirSync(skinsDir)) {
    const p = join(skinsDir, name);
    if (statSync(p).isFile() && name.endsWith(".json")) {
      assertSkinClean("skins/" + name);
    }
  }

  const exampleSkin = readJson("skins/kanzlei.example.json");
  const css = read("css/app.css");

  // dist/web — Hostinger folder: no loose JSON; baked globals inside app.js
  const webDir = join(root, "dist/web");
  mkdirSync(webDir, { recursive: true });
  const webBake = bakeGlobals(ruleset, copy, affiliates, null);
  const webJs = concatAppJs(webBake);
  writeFileSync(join(webDir, "app.js"), webJs);
  writeFileSync(join(webDir, "app.css"), css);
  let webHtml = read("index.html");
  webHtml = webHtml.replace('href="css/app.css"', 'href="app.css"');
  webHtml = webHtml.replace(
    /\s*<script src="js\/calc\.js"><\/script>\s*<script src="js\/route\.js"><\/script>\s*<script src="js\/affiliates\.js"><\/script>\s*<script src="js\/skin\.js"><\/script>\s*<script src="js\/app\.js"><\/script>\s*/,
    '\n  <script src="app.js"></script>\n'
  );
  writeFileSync(join(webDir, "index.html"), webHtml);

  // dist/kanzlei — single file with optional example skin bake
  const kanzleiDir = join(root, "dist/kanzlei");
  mkdirSync(kanzleiDir, { recursive: true });
  const kBake = bakeGlobals(ruleset, copy, affiliates, exampleSkin);
  const kJs = concatAppJs(kBake);
  const kHtml = htmlWithInlineCssJs(css, kJs, true);
  writeFileSync(join(kanzleiDir, "nachweischeck.html"), kHtml);

  // Sanity: escaped script close
  if (/<\/script>/i.test(safeJsonInline({ x: "</script>" })) === false) {
    /* ok — escaped */
  }
  const probe = safeJsonInline({ x: "</script>" });
  if (probe.includes("</script>")) {
    throw new Error("safeJsonInline failed to escape </script>");
  }

  console.log("Packed dist/web/ and dist/kanzlei/nachweischeck.html");
  console.log("ruleset", ruleset.version, ruleset.stand);
}

pack();
