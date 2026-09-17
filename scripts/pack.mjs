#!/usr/bin/env node
/**
 * Zero-deps packer: bake JSON into window globals for dist/web and dist/kanzlei.
 *
 * The default pack bakes no skin at all. A Kanzlei name is a runtime concern and
 * arrives via ?name= (see js/skin.js), so no artifact ever ships a placeholder
 * firm name as if it were production. Pass --skin to bake one deliberately.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_SKIN = "skins/kanzlei.example.json";

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

/**
 * --skin            → bake skins/kanzlei.example.json
 * --skin=path.json  → bake that file
 * absent            → bake nothing
 */
function parseArgs(argv) {
  let skin = null;
  for (const arg of argv) {
    if (arg === "--skin") {
      skin = DEFAULT_SKIN;
    } else if (arg.startsWith("--skin=")) {
      const value = arg.slice("--skin=".length).trim();
      if (!value) throw new Error("--skin= needs a path, e.g. --skin=skins/mine.json");
      skin = value;
    } else if (arg.startsWith("--")) {
      throw new Error("Unknown flag: " + arg);
    }
  }
  return { skin };
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

/** A rewrite that silently matched nothing would ship an unstyled artifact. */
function replaceOnce(html, pattern, replacement, what) {
  const out = html.replace(pattern, replacement);
  if (out === html) {
    throw new Error(
      "pack rewrite did not change index.html: " +
        what +
        ". The markup drifted away from the packer pattern."
    );
  }
  return out;
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

const SCRIPT_TAGS =
  /\s*<script src="js\/calc\.js"><\/script>\s*<script src="js\/route\.js"><\/script>\s*<script src="js\/affiliates\.js"><\/script>\s*<script src="js\/skin\.js"><\/script>\s*<script src="js\/app\.js"><\/script>\s*/;
const CSS_LINK = /<link rel="stylesheet" href="css\/app\.css">\s*/;

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

function packWeb(ruleset, copy, affiliates, skin, css) {
  const dir = join(root, "dist/web");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "app.js"), concatAppJs(bakeGlobals(ruleset, copy, affiliates, skin)));
  writeFileSync(join(dir, "app.css"), css);

  let html = read("index.html");
  html = replaceOnce(
    html,
    CSS_LINK,
    '<link rel="stylesheet" href="app.css">\n',
    "dist/web stylesheet link → flat app.css"
  );
  html = replaceOnce(
    html,
    SCRIPT_TAGS,
    '\n  <script src="app.js"></script>\n',
    "dist/web script tags → flat app.js"
  );
  writeFileSync(join(dir, "index.html"), html);
  return html;
}

function packKanzlei(ruleset, copy, affiliates, skin, css) {
  const dir = join(root, "dist/kanzlei");
  mkdirSync(dir, { recursive: true });

  let html = read("index.html");
  html = replaceOnce(
    html,
    CSS_LINK,
    "<style>\n" + css + "\n</style>\n",
    "dist/kanzlei stylesheet link → inline <style>"
  );
  html = replaceOnce(
    html,
    SCRIPT_TAGS,
    "\n  <script>\n" + concatAppJs(bakeGlobals(ruleset, copy, affiliates, skin)) + "\n  </script>\n",
    "dist/kanzlei script tags → inline <script>"
  );
  writeFileSync(join(dir, "nachweischeck.html"), html);
  return html;
}

function assertSingleFile(html) {
  if (/<script src=/.test(html)) {
    throw new Error("dist/kanzlei must not reference external scripts");
  }
  if (/<link rel="stylesheet"/.test(html)) {
    throw new Error("dist/kanzlei must not reference an external stylesheet");
  }
}

function pack() {
  const { skin: skinPath } = parseArgs(process.argv.slice(2));

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

  let skin = null;
  if (skinPath) {
    assertSkinClean(skinPath);
    skin = readJson(skinPath);
  }

  const css = read("css/app.css");

  // dist/web — Hostinger folder: flat files, no loose JSON, baked globals.
  packWeb(ruleset, copy, affiliates, skin, css);

  // dist/kanzlei — single file, zero network.
  const kanzlei = packKanzlei(ruleset, copy, affiliates, skin, css);
  assertSingleFile(kanzlei);

  const probe = safeJsonInline({ x: "</script>" });
  if (probe.includes("</script>")) {
    throw new Error("safeJsonInline failed to escape </script>");
  }

  console.log("Packed dist/web/ and dist/kanzlei/nachweischeck.html");
  console.log("ruleset", ruleset.version, ruleset.stand);
  console.log(
    skinPath
      ? "skin baked: " + skinPath
      : "skin: none — Kanzlei name comes from ?name= at runtime"
  );
}

pack();
