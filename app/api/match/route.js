function store() {
  if (!globalThis.__billiardsQueue) {
    globalThis.__billiardsQueue = { waiting: {}, matched: {} };
  }
  return globalThis.__billiardsQueue;
}

function clean(address) {
  return String(address || '').trim().toLowerCase();
}

function valid(address) {
  return /^0x[a-f0-9]{40}$/.test(address);
}

function cueOf(value) {
  var id = String(value || 'classic').toLowerCase();
  return /^[a-z]{3,16}$/.test(id) ? id : 'classic';
}

export async function POST(request) {
  const body = await request.json().catch(function () { return {}; });
  const address = clean(body.address);
  const city = String(body.city || '');
  const cue = cueOf(body.cue);
  if (!valid(address) || !city || city === 'bot') {
    return Response.json({ error: 'Connect MetaMask first' }, { status: 400 });
  }
  const db = store();
  const already = db.matched[address];
  if (already && already.city === city && Date.now() - already.at < 15000) {
    return Response.json({ status: 'matched', opponent: already.opponent, opponentCue: already.opponentCue || 'classic', city: city });
  }
  const seat = db.waiting[city];
  if (seat && seat.address !== address && Date.now() - seat.at < 120000) {
    const now = Date.now();
    db.matched[address] = { opponent: seat.address, opponentCue: seat.cue || 'classic', city: city, at: now };
    db.matched[seat.address] = { opponent: address, opponentCue: cue, city: city, at: now };
    delete db.waiting[city];
    return Response.json({ status: 'matched', opponent: seat.address, opponentCue: seat.cue || 'classic', city: city });
  }
  db.waiting[city] = { address: address, cue: cue, at: Date.now() };
  return Response.json({ status: 'waiting', city: city });
}

export async function GET(request) {
  const url = new URL(request.url);
  const address = clean(url.searchParams.get('address'));
  const city = String(url.searchParams.get('city') || '');
  if (!valid(address)) return Response.json({ status: 'idle' });
  const db = store();
  const hit = db.matched[address];
  if (hit && hit.city === city && Date.now() - hit.at < 20000) {
    return Response.json({ status: 'matched', opponent: hit.opponent, opponentCue: hit.opponentCue || 'classic', city: city });
  }
  const seat = db.waiting[city];
  if (seat && seat.address === address) return Response.json({ status: 'waiting', city: city });
  return Response.json({ status: 'idle' });
}

export async function DELETE(request) {
  const url = new URL(request.url);
  const address = clean(url.searchParams.get('address'));
  const db = store();
  Object.keys(db.waiting).forEach(function (city) {
    if (db.waiting[city].address === address) delete db.waiting[city];
  });
  delete db.matched[address];
  return Response.json({ status: 'left' });
}
