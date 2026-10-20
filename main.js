// Admission desk data. Rule IDs and limits come from ERC-8421 and EIP-8141.
// Gas figures for each scenario are illustrative.
const SCENARIOS = [
  {
    id: 'token',
    label: 'Token paymaster',
    stakeLabel: 'The paymaster has staked',
    checks: [
      { text: 'Prefix shape: only_verify, pre_verify, pay',
        canonical: [false, 'Not one of the four recognized prefixes.'],
        standard: [true, 'A pre_verify frame may precede the approving frame.', 'PREFIX-110'] },
      { text: 'Reads the sender’s token balance in the ERC-20 contract',
        canonical: [false, 'Third-party mutable storage is rejected.'],
        standard: [true, 'Slot is associated with the sender.', 'STORAGE-021'] },
      { text: 'Paymaster keeps its own budget in storage',
        canonical: [false, 'Third-party mutable storage is rejected.'],
        standard: { unstaked: [false, 'Own storage needs stake.', 'STORAGE-031'], staked: [true, 'A staked entity may use its own storage.', 'STORAGE-031'] } },
      { text: 'Many pending transactions use this paymaster',
        canonical: [false, 'One pending transaction per non-canonical paymaster.'],
        standard: { unstaked: [true, 'Starts at 10 pending, growing with inclusions.', 'REPUTATION-220'], staked: [true, 'No cap while its reputation is ACTIVE.', 'REPUTATION-020'] } },
    ],
    note: 'ERC-4337 token paymasters pulled tokens during validation. Frame Transactions keep that with a pre_verify frame.',
  },
  {
    id: 'privacy',
    label: 'Privacy withdrawal',
    stakeLabel: 'The shared sender contract has staked',
    checks: [
      { text: 'Proof verification uses about 350,000 gas',
        canonical: [false, 'Prefix limit is 100,000 gas in total.'],
        standard: { unstaked: [false, 'Limit is 100,000 per unstaked entity.', 'BUDGET-010'], staked: [true, 'Staked entities get 1,000,000.', 'BUDGET-010'] } },
      { text: 'Merkle root read from the sender’s own storage',
        canonical: [true, 'The sender’s own storage is allowed.'],
        standard: [true, 'Always allowed.', 'STORAGE-010'] },
      { text: 'Every user picks a fresh nonce key, thousands pending',
        canonical: [null, 'Not what the canonical rules were built for.'],
        standard: { unstaked: [false, 'At most 64 pending for an unstaked sender.', 'LIFECYCLE-030'], staked: [true, 'No sender-wide limit while ACTIVE.', 'LIFECYCLE-030'] } },
      { text: 'Reputation to earn trust over time',
        canonical: [null, 'The public mempool has no reputation system.'],
        standard: [true, 'Included transactions raise the allowance.', 'REPUTATION'] },
    ],
    note: 'Gas figure is illustrative. Keyed nonces come from EIP-8250.',
  },
  {
    id: 'keystore',
    label: 'Keystore wallet',
    stakeLabel: 'The factory has staked',
    checks: [
      { text: 'Credentials read from a keystore contract',
        canonical: [false, 'Storage outside the sender is rejected.'],
        standard: [true, 'Slot is associated with the sender.', 'STORAGE-021'] },
      { text: 'First transaction also deploys the account',
        canonical: [true, 'deploy, self_verify is a recognized prefix.'],
        standard: { unstaked: [false, 'Reading external storage needs a staked factory.', 'STORAGE-022'], staked: [true, 'The factory is staked.', 'STORAGE-022'] } },
      { text: 'Verification stays under 100,000 gas',
        canonical: [true, 'Within MAX_VERIFY_GAS.'],
        standard: [true, 'Within the per-entity budget.', 'BUDGET-010'] },
    ],
    note: 'For an existing account, the keystore read passes without any stake.',
  },
  {
    id: 'pq',
    label: 'Post-quantum signature',
    stakeLabel: 'The sender has staked',
    checks: [
      { text: 'Signature check in plain EVM code, about 700,000 gas',
        canonical: [false, 'Prefix limit is 100,000 gas in total.'],
        standard: { unstaked: [false, 'Limit is 100,000 per unstaked entity.', 'BUDGET-010'], staked: [true, 'Staked entities get 1,000,000.', 'BUDGET-010'] } },
      { text: 'Public key held in the sender’s storage',
        canonical: [true, 'The sender’s own storage is allowed.'],
        standard: [true, 'Always allowed.', 'STORAGE-010'] },
      { text: 'Only precompiles 0x01 to 0x11 and P256VERIFY called',
        canonical: [true, 'Stateless precompiles are fine.'],
        standard: [true, 'Allowed.', 'CALLING-040'] },
    ],
    note: 'Gas figure is illustrative. A precompile would make this cheap, but no such precompile exists today.',
  },
];

const state = { scenario: 'token', mempool: 'canonical', staked: false };
const $ = (id) => document.getElementById(id);

function resolve(check, mp) {
  if (mp === 'canonical') return check.canonical;
  const s = check.standard;
  return Array.isArray(s) ? s : s[state.staked ? 'staked' : 'unstaked'];
}

function renderDesk() {
  const sc = SCENARIOS.find((s) => s.id === state.scenario);
  const checks = $('checks');
  const verdict = $('verdict');
  const stakeRow = $('stakeRow');
  checks.textContent = '';

  if (state.mempool === 'custom') {
    stakeRow.hidden = true;
    verdict.innerHTML = '<span class="tag yes">Your call</span><span class="why">An operator writes the rules.</span>';
    const li = document.createElement('li');
    li.innerHTML = '<span class="st na">any</span><span>Each alternative mempool is identified by its own topic, conventionally the IPFS hash of a document describing its rules. Allow a trusted contract, raise a limit, or track reputation your own way. A transaction can join every mempool whose rules it satisfies.</span>';
    checks.append(li);
    $('note').textContent = '';
    return;
  }

  const hasStakeEffect = state.mempool === 'standard' && sc.checks.some((c) => !Array.isArray(c.standard));
  stakeRow.hidden = !hasStakeEffect;
  stakeRow.querySelector('span').textContent = sc.stakeLabel + ' (at least MIN_STAKE_VALUE, one-day unstake delay)';

  let blockers = 0;
  sc.checks.forEach((c) => {
    const [ok, text, rule] = resolve(c, state.mempool);
    if (ok === false) blockers++;
    const li = document.createElement('li');
    const st = document.createElement('span');
    st.className = 'st ' + (ok === true ? 'pass' : ok === false ? 'fail' : 'na');
    st.textContent = ok === true ? 'pass' : ok === false ? 'fail' : 'n/a';
    const body = document.createElement('span');
    body.textContent = c.text + '. ' + text;
    if (rule) {
      const r = document.createElement('span');
      r.className = 'rule';
      r.textContent = rule;
      body.append(r);
    }
    li.append(st, body);
    checks.append(li);
  });

  verdict.innerHTML = blockers
    ? `<span class="tag no">Rejected</span><span class="why">${blockers} rule${blockers > 1 ? 's' : ''} fail.</span>`
    : '<span class="tag yes">Admitted</span><span class="why">Every rule passes.</span>';
  $('note').textContent = sc.note;
}

function buildScenarioPicker() {
  const wrap = $('scenarios');
  SCENARIOS.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(s.id === state.scenario));
    b.textContent = s.label;
    b.addEventListener('click', () => {
      state.scenario = s.id;
      state.staked = false;
      $('staked').checked = false;
      wrap.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      renderDesk();
    });
    wrap.append(b);
  });
}

document.querySelectorAll('.tabs button').forEach((b) => {
  b.addEventListener('click', () => {
    state.mempool = b.dataset.mp;
    document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    renderDesk();
  });
});
$('staked').addEventListener('change', (e) => { state.staked = e.target.checked; renderDesk(); });

// Prefix diagrams
const PREFIXES = [
  { title: 'Self relay', frames: ['self_verify'] },
  { title: 'Self relay, new account', frames: ['deploy', 'self_verify'] },
  { title: 'Canonical paymaster', frames: ['only_verify', 'pay'] },
  { title: 'Canonical paymaster, new account', frames: ['deploy', 'only_verify', 'pay'] },
];
const pf = $('prefixes');
PREFIXES.forEach((p) => {
  const d = document.createElement('div');
  d.className = 'prefix';
  d.setAttribute('role', 'listitem');
  const h = document.createElement('h4');
  h.textContent = p.title;
  const row = document.createElement('div');
  row.className = 'frames';
  p.frames.concat('user_op…').forEach((f, i, a) => {
    const s = document.createElement('div');
    const last = i === a.length - 1;
    s.className = 'frame' + (last ? ' tail' : f === 'pay' ? ' pay' : f === 'deploy' ? ' deploy' : '');
    s.textContent = f;
    row.append(s);
  });
  d.append(h, row);
  pf.append(d);
});

// Reputation calculator, ERC-8421 constants
const DENOM = 10, THROTTLE = 10, BAN = 50;
function renderRep() {
  const seen = +$('seen').value, inc = +$('inc').value;
  $('seenOut').textContent = seen;
  $('incOut').textContent = inc;
  const maxSeen = Math.floor(seen / DENOM);
  let st = 'ACTIVE', msg = 'No extra limits. A staked entity here has no cap on pending transactions.';
  if (maxSeen > inc + BAN) { st = 'BANNED'; msg = 'Not allowed into the mempool. Pending transactions that reference it are removed.'; }
  else if (maxSeen > inc + THROTTLE) { st = 'THROTTLED'; msg = 'At most 4 pending, 4 per block built, and 10 blocks of residency.'; }
  $('repResult').innerHTML = `<div class="state ${st}">${st}</div><p>seen ÷ 10 = ${maxSeen}, included = ${inc}</p><p>${msg}</p>`;
}
$('seen').addEventListener('input', renderRep);
$('inc').addEventListener('input', renderRep);

buildScenarioPicker();
renderDesk();
renderRep();
