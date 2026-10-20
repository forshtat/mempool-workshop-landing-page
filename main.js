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
