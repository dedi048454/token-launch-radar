// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, a filterable table, a per-protocol
// detail drawer with the model's own factors and the protocol's farm plan, and
// a live view of the tokens that already trade. No network: every byte it
// shows is in data.js. The farm plan and the implied value are derived here
// from the same rules main.ts uses, so the page and board.json agree.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var MODEL = DATA.model;
  var state = { q: '', category: 'all', chain: 'all', watchlistOnly: false, tab: 'board', sort: 'implied_value_usd', dir: -1, selected: null, sandbox: null };

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ---- the model, in the page: the same arithmetic main.ts runs ----
  function impliedOf(row, weight, floor) {
    var growth = Math.min(MODEL.growth_cap, Math.max(MODEL.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * weight;
    var age = row.age_days === null || row.age_days === undefined ? MODEL.unknown_age_days : row.age_days;
    var maturity = floor + (Math.min(Math.max(age, 0), MODEL.maturity_days) / MODEL.maturity_days) * (1 - floor);
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * growthMult * maturity));
  }

  // ---- the farm plan, in the page: the same derivation main.ts writes ----
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Lend $' + capital + ' of USDC on ' + name + ' (' + chain + ') and leave the deposit earning.';
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Add $' + capital + ' of liquidity to ' + name + "'s deepest pool on " + chain + ' and keep the LP position.';
    if (c.indexOf('yield') >= 0) return 'Deposit $' + capital + " into " + name + "'s main yield vault on " + chain + ' and hold the shares.';
    if (c.indexOf('bridge') >= 0) return 'Move $' + capital + ' of USDC across ' + name + ' to ' + chain + ' and put the bridged funds to work in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + ' of the base asset through ' + name + ' and hold the receipt token.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Post $' + capital + ' of USDC as margin on ' + name + ' and open a single small hedged trade.';
    if (c.indexOf('rwa') >= 0) return 'Buy $' + capital + ' of ' + name + "'s yield-bearing asset on " + chain + ' and hold it through one accrual cycle.';
    if (c.indexOf('risk') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Allocate $' + capital + ' into a ' + name + ' vault on ' + chain + ' and hold the vault shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or hold $' + capital + ' of ' + name + "'s stable asset on " + chain + '.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    if (c.indexOf('payment') >= 0) return 'Route $' + capital + ' of payments through ' + name + ' on ' + chain + ' over the next month.';
    return 'Open a $' + capital + ' position in ' + name + ' on ' + chain + ' and keep it active.';
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var steps = [
      { text: 'Open a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Do one qualifying action each week — a deposit, a swap, a vote or a borrow — and keep a note of it.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity lands in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page from the link it publishes and claim only there.", cost: 'free to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' },
    ];
    return steps.map(function (s) { return s.text + ' Cost: ' + s.cost + '. Time: ' + s.time + '.'; });
  }

  // ---- data views ----
  function visibleRows() {
    var rows = DATA.rows.slice();
    if (state.sandbox) {
      rows = rows.map(function (r) {
        var copy = Object.assign({}, r);
        copy.implied_value_usd = impliedOf(r, state.sandbox.weight, state.sandbox.floor);
        return copy;
      });
      rows.sort(function (a, b) { return b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : 1); });
      rows.forEach(function (r, i) { r.rank = i + 1; });
    }
    var q = state.q.trim().toLowerCase();
    if (q) rows = rows.filter(function (r) { return r.name.toLowerCase().indexOf(q) >= 0 || r.slug.toLowerCase().indexOf(q) >= 0; });
    if (state.category !== 'all') rows = rows.filter(function (r) { return r.category === state.category; });
    if (state.chain !== 'all') rows = rows.filter(function (r) { return r.chains && r.chains.indexOf(state.chain) >= 0; });
    if (state.watchlistOnly) {
      var wl = new Set(DATA.watchlist);
      rows = rows.filter(function (r) { return wl.has(r.slug); });
    }
    var key = state.sort;
    var dir = state.dir;
    rows.sort(function (a, b) {
      var av = a[key], bv = b[key];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return rows;
  }

  // ---- rendering ----
  var $ = function (id) { return document.getElementById(id); };
  function renderStats() {
    var top = DATA.rows[0];
    $('stats').innerHTML =
      '<div><dt>Snapshot</dt><dd>' + esc(DATA.as_of) + '</dd></div>' +
      '<div><dt>Watchlist</dt><dd>' + DATA.watchlist_size + '</dd></div>' +
      '<div><dt>Board rows</dt><dd>' + DATA.board_size + '</dd></div>' +
      '<div><dt>Early rows</dt><dd>' + DATA.early_size + '</dd></div>' +
      '<div><dt>Top implied</dt><dd>' + fmtUsd(top ? top.implied_value_usd : 0) + '</dd></div>' +
      '<div><dt>Model</dt><dd>' + esc(DATA.model_version) + '</dd></div>';
    $('source').textContent = 'Source: ' + DATA.source + '. Floor: ' + fmtUsd(DATA.floor_usd) + ' TVL. Board: ' + DATA.board_size + ' rows, ranks 1–' + DATA.board_size + '.';
  }
  function renderFilters() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category; }).filter(Boolean))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    $('category').innerHTML = '<option value="all">All categories</option>' + cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
    $('chain').innerHTML = '<option value="all">All chains</option>' + chains.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  }
  function renderBoard() {
    var rows = visibleRows();
    var watchlist = new Set(DATA.watchlist);
    $('rows').innerHTML = rows.map(function (r) {
      var chg = r.change_7d === null || r.change_7d === undefined ? 'n/a' : '<span class="' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + fmtPct(r.change_7d) + '</span>';
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.selected === r.slug ? ' class="selected"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span><br><span class="slug">' + esc(r.slug) + '</span> ' + (watchlist.has(r.slug) ? '<span class="tag watch">watchlist</span>' : '') + '</td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + (r.chains || []).slice(0, 3).map(function (c) { return '<span class="tag">' + esc(c) + '</span>'; }).join(' ') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num">' + chg + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num val">' + fmtUsd(r.implied_value_usd) + '</td></tr>';
    }).join('');
    $('count').textContent = rows.length + ' of ' + DATA.board_size + ' rows';
    document.querySelectorAll('#board thead th').forEach(function (th) {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === state.sort);
      th.classList.toggle('asc', state.dir === 1);
    });
  }
  function renderLive() {
    $('liveRows').innerHTML = DATA.live.map(function (r) {
      return '<tr><td><span class="name">' + esc(r.name) + '</span><br><span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + (r.chains || []).slice(0, 3).map(function (c) { return '<span class="tag">' + esc(c) + '</span>'; }).join(' ') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num val">' + fmtUsd(r.mcap_usd) + '</td>' +
        '<td class="num">' + fmtPct(r.change_7d) + '</td></tr>';
    }).join('');
  }
  function renderDetail() {
    var box = $('detail');
    var row = DATA.rows.find(function (r) { return r.slug === state.selected; });
    if (!row) {
      box.innerHTML = '<p class="empty">Select a protocol on the board to see its detail: the model’s factors, the implied value, and the farm plan.</p>';
      return;
    }
    var growth = Math.min(MODEL.growth_cap, Math.max(MODEL.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var steps = farmSteps(row);
    box.innerHTML =
      '<h3>' + esc(row.name) + '</h3>' +
      '<p class="meta">Rank #' + row.rank + ' · ' + esc(row.category || 'uncategorised') + ' · ' + (row.chains || []).map(esc).join(', ') + '<br>Records no token in the snapshot. Listed ' + (row.listed_at || 'on an unknown day') + ' (' + fmtAge(row.age_days) + ').</p>' +
      '<h4>Implied value — how it is worked out</h4>' +
      '<table class="factors"><tbody>' +
      '<tr><td>TVL</td><td>' + fmtUsd(row.tvl_usd) + '</td></tr>' +
      '<tr><td>Category multiple</td><td>× ' + row.category_multiple.toFixed(3) + '</td></tr>' +
      '<tr><td>Growth (' + fmtPct(growth) + ' 7d)</td><td>× ' + row.growth_multiplier.toFixed(3) + '</td></tr>' +
      '<tr><td>Maturity (' + fmtAge(row.age_days) + ')</td><td>× ' + row.maturity_multiplier.toFixed(3) + '</td></tr>' +
      '<tr class="total"><td>Implied value</td><td>' + fmtUsd(row.implied_value_usd) + '</td></tr>' +
      '</tbody></table>' +
      '<p class="meta">The multiple is the median market-cap-per-TVL of live-token protocols in this category, read from the snapshot — not a number typed in for this protocol.</p>' +
      '<h4>Farm plan — 6 steps</h4><ol class="steps">' + steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<p class="meta">The implied value is this entry’s own claim about what a launch would be worth if the record stayed as it is. It does not predict whether or when a token is issued.</p>';
  }

  // ---- wiring ----
  $('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
  $('category').addEventListener('change', function (e) { state.category = e.target.value; renderBoard(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
  $('watchlistOnly').addEventListener('change', function (e) { state.watchlistOnly = e.target.checked; renderBoard(); });
  document.querySelectorAll('.tabs button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.tab = btn.getAttribute('data-tab');
      document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('active', b === btn); b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      $('board').hidden = state.tab !== 'board';
      $('live').hidden = state.tab !== 'live';
      if (state.tab === 'live') renderLive();
    });
  });
  document.querySelectorAll('#board thead th').forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-sort');
      if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = key === 'name' || key === 'category' || key === 'chains' ? 1 : -1; }
      renderBoard();
    });
  });
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    state.selected = tr.getAttribute('data-slug');
    renderBoard();
    renderDetail();
    $('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  function sandboxChanged() {
    var w = parseFloat($('growthWeight').value);
    var f = parseFloat($('maturityFloor').value);
    $('growthWeightOut').textContent = w.toFixed(2);
    $('maturityFloorOut').textContent = f.toFixed(2);
    var def = Math.abs(w - MODEL.growth_weight) < 1e-9 && Math.abs(f - MODEL.maturity_floor) < 1e-9;
    state.sandbox = def ? null : { weight: w, floor: f };
    $('sandboxNote').hidden = def;
    renderBoard();
  }
  $('growthWeight').addEventListener('input', sandboxChanged);
  $('maturityFloor').addEventListener('input', sandboxChanged);
  $('resetModel').addEventListener('click', function () {
    $('growthWeight').value = String(MODEL.growth_weight);
    $('maturityFloor').value = String(MODEL.maturity_floor);
    sandboxChanged();
  });

  renderStats();
  renderFilters();
  renderBoard();
  renderDetail();
})();
