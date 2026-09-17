# Go-to-market (Betreiber)

Operator-facing. Not for the Mandant — hand out [`KANZLEI.md`](KANZLEI.md) instead.

## One artifact, two deliveries

There is exactly one product. Both outputs come from the same source and the same `node scripts/pack.mjs` run:

| Output | What it is | Where it goes |
| --- | --- | --- |
| `dist/web/` | flat `index.html` + `app.css` + `app.js`, globals baked | public site (Hostinger FTP) |
| `dist/kanzlei/nachweischeck.html` | single file, CSS and JS inlined, zero network | USB stick, e-mail attachment, Kanzlei static host |

Do not fork a "Kanzlei edition". A Kanzlei name is a runtime parameter (`?name=`), never a second codebase. If someone asks for different wording of the law, the answer is no — that is the whole point of one artifact.

`dist/` is gitignored. Never commit it.

## Positioning: the public site is education

`nachweischeck.de` is an educational explainer that happens to contain labeled affiliate exits. It is not a calculator, not a lead form, not a SaaS trial.

That framing is load-bearing for two reasons. It keeps the page defensible under StBerG — no individual advice, no diagnosed Nutzungsdauer, no promised outcome. And it is the only version a Steuerkanzlei will put its name on. A page that reads as affiliate bait is worthless in the channel that actually matters.

Concretely, this means the following stay out: pop-up lead gates, e-mail capture, exit-intent overlays, countdowns, tracking pixels, analytics, A/B tooling, "savings" arrows, testimonials, and any claim about Erfolgsaussichten or Anerkennungsquoten.

## Distribution: Kanzleien and the domain

The channel is Steuerkanzleien plus the public domain:

1. **Kanzlei-Direktansprache.** The pitch is Mandanten-Entlastung: the StB stops explaining § 7 Abs. 4 Satz 2 EStG from scratch in every meeting, hands over one file, and gets a printable Gesprächsnotiz for the Akte. Offline, no Objektdaten leave the browser, no commission for the Kanzlei.
2. **USB stick or e-mail attachment** with `dist/kanzlei/nachweischeck.html`, plus [`KANZLEI.md`](KANZLEI.md) as the cover note.
3. **The public domain** for organic search and as the link a Kanzlei can point at.

**Not Kleinanzeigen.** Not marketplace listings, not classified ads, not cold DM blasts. Wrong audience, wrong signal, and it burns the professional framing the Kanzlei channel depends on.

## Release checklist

Before the first public FTP upload:

1. **Paste the live affiliate URLs.** [`config/affiliates.json`](../config/affiliates.json) ships placeholders (`https://example.invalid/…`, `PLACEHOLDER_ND`). Replace `urlTemplate` and `id` per lever, keep `{id}` in the template, then repack. Affiliate IDs live only in this file — never in a skin.
2. **Replace the Impressum placeholders.** [`config/copy.de.json`](../config/copy.de.json) still contains `[PLATZHALTER: …]` for Betreiber, Anschrift, Kontakt, USt-IdNr. and the verantwortliche Person. Shipping those live is a legal defect, not a cosmetic one. Check with `rg PLATZHALTER config/copy.de.json` — it must return nothing before upload.
3. **Check the Stand.** `version` and `stand` in [`rulesets/current.json`](../rulesets/current.json) are human-owned and appear in the footer. Bump them when the legal content changes.
4. **Run the gates.** `node --test tests/` and `node scripts/pack.mjs` must both be green. The packer fails loudly if a copy key is missing, if a skin carries affiliate keys, or if an `index.html` rewrite silently stopped matching.
5. **Open the packed file offline.** Disconnect, open `dist/kanzlei/nachweischeck.html`, walk the Vermieter and Mieter paths, and print-preview one of them.

## Packing

```sh
node scripts/pack.mjs                      # default: no Kanzlei name baked
node scripts/pack.mjs --skin               # bakes skins/kanzlei.example.json
node scripts/pack.mjs --skin=skins/x.json  # bakes a specific skin
```

The default pack deliberately bakes **no** skin, so no artifact ever ships "Muster Kanzlei GmbH" as if it were production. Use `--skin` only for demos and screenshots. For real Kanzlei delivery, ship the default file and let the name arrive via `?name=`.

A skin may only set `name`, `logoUrl`, `footerExtra` and `accent`. It can never change the copy of the law or the affiliate IDs; `js/skin.js` strips anything else and the packer refuses a skin that carries affiliate keys.

## Money model

Revenue is the labeled affiliate exits, nothing else. No subscription, no gating, no upsell inside the artifact.

The Kanzlei receives **no** commission, and the footer says so whenever a name is present. Keep it that way: a Kanzlei taking a provision on a Nutzungsdauer-Gutachten it recommended is exactly the conflict this product must not create.
