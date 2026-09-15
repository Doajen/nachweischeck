import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadNC } from "./load.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const affiliates = JSON.parse(
  readFileSync(join(root, "config/affiliates.json"), "utf8")
);
const NC = loadNC();

describe("NC.affiliates", () => {
  it("buildUrl fills {id} from placeholders", () => {
    NC.affiliates.setConfig(affiliates);
    const url = NC.affiliates.buildUrl("rnd", "primary");
    assert.equal(
      url,
      "https://example.invalid/rnd-primary?ref=PLACEHOLDER_ND"
    );
    assert.equal(url.includes("example.invalid"), true);
  });

  it("missing slot returns null", () => {
    NC.affiliates.setConfig(affiliates);
    assert.equal(NC.affiliates.buildUrl("rnd", "tertiary"), null);
  });
});

describe("NC.skin", () => {
  it("strips affiliate keys", () => {
    const cleaned = NC.skin.stripAffiliateKeys({
      name: "Kanzlei X",
      id: "EVIL",
      urlTemplate: "https://evil.example/{id}",
      affiliates: { rnd: {} },
      footerExtra: "ok",
    });
    assert.equal(cleaned.name, "Kanzlei X");
    assert.equal(cleaned.footerExtra, "ok");
    assert.equal(cleaned.id, undefined);
    assert.equal(cleaned.urlTemplate, undefined);
    assert.equal(cleaned.affiliates, undefined);
  });

  it("detects affiliate keys", () => {
    assert.equal(NC.skin.skinHasAffiliateKeys({ name: "A" }), false);
    assert.equal(NC.skin.skinHasAffiliateKeys({ name: "A", id: "x" }), true);
  });
});
