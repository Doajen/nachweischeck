import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadRuleset() {
  return JSON.parse(readFileSync(join(root, "rulesets/current.json"), "utf8"));
}

export function loadFixture(name) {
  return JSON.parse(
    readFileSync(join(root, "tests/fixtures", name), "utf8")
  );
}

/** Load IIFE scripts into an isolated context; returns NC. */
export function loadNC() {
  const context = { console };
  context.globalThis = context;
  // Minimal location for skin query parsing in tests
  context.location = { search: "" };
  context.document = {
    getElementById: () => null,
    documentElement: { style: { setProperty: () => {} } },
  };
  vm.createContext(context);
  for (const file of [
    "js/calc.js",
    "js/route.js",
    "js/affiliates.js",
    "js/skin.js",
  ]) {
    const code = readFileSync(join(root, file), "utf8");
    vm.runInContext(code, context, { filename: file });
  }
  return context.NC;
}

export function assertNoUserNd(obj, assert) {
  const forbidden = ["userNdJahre", "ihreNdJahre", "restnutzungsdauerJahre"];
  const json = JSON.stringify(obj);
  for (const key of forbidden) {
    assert.equal(json.includes(`"${key}"`), false, `must not contain ${key}`);
  }
}
