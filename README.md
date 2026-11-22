[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/dedi048454/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/dedi048454/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

[Token launch radar bounty](https://make.fun/bounty/token-radar-01)

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
