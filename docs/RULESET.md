# Ruleset ownership and v0 contract

## Ownership

- Live file: [`rulesets/current.json`](../rulesets/current.json). Human-owned. The app embeds only this file.
- Hermes may propose patches under `rulesets/proposals/` (never loaded by the app). A human reviews, copies into `current.json`, archives the previous file, then runs pack.
- UI `version` and `stand` come only from `current.json`. Do not hardcode them in HTML/JS/CSS.

## Production bake (mandatory)

Production artifacts must **not** `fetch` JSON.

`scripts/pack.mjs` (Slice D) inlines into both `dist/web` and `dist/kanzlei`:

- `window.__NC_RULESET__` ← `rulesets/current.json`
- `window.__NC_COPY__` ← `config/copy.de.json`
- `window.__NC_AFFILIATES__` ← `config/affiliates.json`

Packed HTML must run with zero network (`file://` and Hostinger). Source JSON remains git-owned; bump by editing `current.json`, then repack.

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

## Affiliate config

IDs and `urlTemplate` values in [`config/affiliates.json`](../config/affiliates.json) are placeholders. No live partner URLs in v0 until you replace them. Skins must never contain affiliate fields.
