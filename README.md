# Token Radar — Build the best token launch radar

An entry for make.fun's `token-radar-01` bounty ($1,325; deadline 14 Dec 2026
10:00 UTC). It reads the sealed DefiLlama snapshot, ranks every pre-token
protocol by what its launch would be worth, and hands in a static dashboard
a reader can sort, filter and open per protocol.

## How it runs

```sh
node main.ts --input /path/to/snapshot.json --output out
# or, with the sealed input mounted:
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

`main.ts` writes `board.json` (the ranked board), `data.js` (the dashboard's
dataset), `dashboard/`, `screenshots/` and `dossier.json` into the output
directory. The dashboard is a static page: `dashboard/index.html` reads
`data.js`, so the page and the board can never disagree about a number.

## The model (radar-2)

A pre-token protocol is worth what the market already pays for the same kind
of protocol, scaled by how fast it is growing and how long it has run without
a token:

```
implied = TVL × category multiple × growth × maturity
```

- **Category multiple** — the median market-cap-per-TVL of the live-token
  protocols in the same category, read out of the snapshot itself (at least 3
  peers, otherwise the snapshot-wide median), clamped to 0.05–1.5. A DEX token
  trades at a different multiple from a lending token, and the snapshot says
  so. No protocol name is ever special-cased.
- **Growth** — the 7-day TVL change, clamped to −60%…+120%, at half weight.
- **Maturity** — 0.6 + age ÷ 1095 days × 0.4; unknown age counts as 365 days.

The board ranks the snapshot's 40-protocol watchlist (the floor: pre-token,
at or above $50M TVL, not a wrapped, staked or bridged product) plus the 160
pre-token protocols below the floor with the most TVL — 200 rows in all.
Live-token protocols are kept apart in their own view at their market caps.
Each row carries a six-step farm plan derived from the protocol's own record
(category, chains, TVL, age), with a cost and a time on every step.

## The dashboard

`dashboard/` is a static page with no network: a sortable, filterable board,
a detail drawer for every protocol (the model's factors and the farm plan), a
live-token view, and a model sandbox — move a slider and the board re-ranks
live from the same figures. The sandbox never changes `board.json`.

## Files

- `main.ts` — the build program (Node 22, standard library only)
- `lib/model.ts` — the radar-2 model, the farm plans and the snapshot parser
- `dashboard/` — `index.html`, `app.css`, `app.js`
- `vendor/makefun-board.ts` — the kit's dossier library, unchanged
- `screenshots/` — the board, a detail view and a filtered view

## License

MIT — see `LICENSE`.
