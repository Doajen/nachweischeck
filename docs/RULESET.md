# Ruleset ownership and v0 contract

## Ownership

- Live file: [`rulesets/current.json`](../rulesets/current.json). Human-owned. The app embeds only this file.
- Hermes may propose patches under `rulesets/proposals/` (never loaded by the app). A human reviews, copies into `current.json`, archives the previous file, then runs pack.
- UI `version` and `stand` come only from `current.json`. Do not hardcode them in HTML/JS/CSS.

## Production bake (mandatory)

Production artifacts must **not** `fetch` JSON.

`scripts/pack.mjs` inlines into both `dist/web` and `dist/kanzlei`:

- `window.__NC_RULESET__` ← `rulesets/current.json`
- `window.__NC_COPY__` ← `config/copy.de.json`
- `window.__NC_AFFILIATES__` ← `config/affiliates.json`

Packed HTML must run with zero network (`file://` and Hostinger). Source JSON remains git-owned; bump by editing `current.json`, then repack.

### Skins are opt-in

`window.__NC_SKIN__` is **not** baked by default. The default pack ships no Kanzlei name at all — no artifact may carry `Muster Kanzlei GmbH` as if it were production. A name is a runtime concern and arrives via `?name=` (`js/skin.js`).

```sh
node scripts/pack.mjs                      # no skin baked
node scripts/pack.mjs --skin               # bakes skins/kanzlei.example.json
node scripts/pack.mjs --skin=skins/x.json  # bakes a specific skin
```

Use `--skin` only for demos and screenshots. A skin may set `name`, `logoUrl`, `footerExtra` and `accent` only; the packer rejects any skin carrying affiliate keys, and it never overrides copy or the ruleset.

### Rewrite assertions

The packer rewrites two spots in `index.html`: the `css/app.css` stylesheet link and the five `<script src="js/…">` tags. Both rewrites are asserted to have changed the string. If the markup drifts so a pattern no longer matches, the pack **fails** instead of silently emitting an artifact with no CSS or no JS. `dist/kanzlei` is additionally checked to contain no external `<script src=` and no external stylesheet link.

When inlining JSON inside a `<script>` tag, escape every `</script>` / `</Script>` sequence in the serialized string (e.g. replace `<` before `/script` with `\u003c`) so the HTML parser cannot close the script early.

Unpacked source opened as `file://` may show a banner. That is expected.

Do not commit `dist/`.

## Tests

No CI workflow in v0. Use `node --test` and pack assertions only.

## v0 AfA scope — Wohnen § 7 Abs. 4 Satz 1 Nr. 2 only

First-match rows in `afa.rows`:

| id | when | satzPct | gesetzlicheNdJahre |
| --- | --- | --- | --- |
| `nr2a_fertig_ab_2023` | Fertigstellung after `2022-12-31` | 3 | 33 |
| `nr2b_fertig_1925_2022` | after `1924-12-31` and before `2023-01-01` | 2 | 50 |
| `nr2c_fertig_vor_1925` | fallback (otherwise) | 2.5 | 40 |

**Out of v0:** § 7 Abs. 4 Satz 1 Nr. 1 (Betriebsvermögen, nicht Wohnzwecken, Bauantrag after 31.03.1985). No `betriebsvermoegen` / `bauAntragAfter` matchers in the calc.

**nichtwohnen / gemischt:** use the same Nr. 2 table. UI must show copy that AfA for Betriebsvermögen may differ (`afa.nichtwohnenHinweis`). Do not invent a Nr. 1 rate.

**gemischt:** single `gebaeudeanteilEur` field. No m² split between Wohnen and Nichtwohnen.

Also out of v0 for AfA: § 7 Abs. 5 / 5a (degressive), § 7b / QNG, Denkmal § 7i / § 7h.

## RND posture results (enum only)

Posture values returned by `rndPosture` and used by route/CTA: **`primary` | `widen` | `suppress`**. Do not use show / soften / hide.

Thresholds in `rndPosture` (product policy in JSON):

- `suppressIfFertigstellungFrom`: 1996 → `suppress` when Fertigstellung ≥ threshold
- `suppressIfUmfassendModernisiertFrom`: 2016 → `suppress` when modernization is `umfassend` and `modernisierungJahr` ≥ threshold
- `umfassend` with missing/invalid `modernisierungJahr` → `widen`, reason `umfassend_jahr_unbekannt`
- `widenIfModernisierung`: `["unbekannt"]` → `widen`
- else, if Fertigstellung year known and not suppressed → `primary`

Never invent a short user ND. Never return `userNdJahre` or equivalent. Never print “Ihre Restnutzungsdauer beträgt …”.

## Field list (`current.json`)

- `version`, `stand` — footer stamps
- `normRefs` — citation labels only
- `afa.scope`, `afa.note`, `afa.rows[]` — `id`, `when`, `satzPct`, `gesetzlicheNdJahre`, `normId`
- `rndScenarios[]` — `id`, `ndJahre`, `label` (named scenarios only)
- `rndPosture` — thresholds for primary / widen / suppress
- `geg` — Pflicht-Orientierung enums (not a full GEG engine)
- `copyKeys[]` — must exist in `config/copy.de.json`

## GEG Anlass: Neubau in the gate

`geg.pflichtAnlaesse` includes `neubau`. The gate form therefore exposes an Anlass radio **Neubau** (`value="neubau"`). Do not remove `neubau` from the ruleset without removing the radio (or vice versa).

## Affiliate config

IDs and `urlTemplate` values in [`config/affiliates.json`](../config/affiliates.json) are placeholders (`example.invalid`). No live partner URLs in v0 until you replace them.

Skins may only set chrome: `name`, optional `logoUrl`, `footerExtra`, `accent`. If a skin object contains affiliate keys (`affiliate`, `affiliates`, `id`, `urlTemplate`, lever blocks), **ignore them** at runtime; `scripts/pack.mjs` **fails** if example skins ship those keys.

## Skin resolution

1. Query `?name=` (and optional `?footer=`)
2. Same-folder `skin.json` if HTTP fetch works
3. Else public defaults (product name only)

