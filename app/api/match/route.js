function store() {
  if (!globalThis.__billiardsQueue) {
    globalThis.__billiardsQueue = { waiting: {}, matched: {}, rooms: {} };
  }
  if (!globalThis.__billiardsQueue.rooms) globalThis.__billiardsQueue.rooms = {};
  return globalThis.__billiardsQueue;
}

function createRoom(city, hostAddress, hostCue, guestAddress, guestCue) {
  var id = crypto.randomUUID();
  var room = {
    id: id,
    sessionId: id,
    city: city,
    host: hostAddress,
    seats: {},
    cues: { player1: hostCue, player2: guestCue },
    pending: [],
    ready: {},
    aims: {},
    snapshot: null,
    at: Date.now()
  };
  room.seats[hostAddress] = 'player1';
  room.seats[guestAddress] = 'player2';
  store().rooms[id] = room;
  return room;
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
    return Response.json({
      status: 'matched',
      opponent: already.opponent,
      opponentCue: already.opponentCue || 'classic',
      city: city,
      roomId: already.roomId,
      sessionId: already.roomId,
      seat: already.seat
    });
  }
  const seat = db.waiting[city];
  if (seat && seat.address !== address && Date.now() - seat.at < 120000) {
    const now = Date.now();
    const room = createRoom(city, seat.address, seat.cue || 'classic', address, cue);
    db.matched[address] = { opponent: seat.address, opponentCue: seat.cue || 'classic', city: city, at: now, roomId: room.id, seat: 'player2' };
    db.matched[seat.address] = { opponent: address, opponentCue: cue, city: city, at: now, roomId: room.id, seat: 'player1' };
    delete db.waiting[city];
    return Response.json({
      status: 'matched',
      opponent: seat.address,
      opponentCue: seat.cue || 'classic',
      city: city,
      roomId: room.id,
      sessionId: room.id,
      seat: 'player2'
    });
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
    return Response.json({
      status: 'matched',
      opponent: hit.opponent,
      opponentCue: hit.opponentCue || 'classic',
      city: city,
      roomId: hit.roomId,
      sessionId: hit.roomId,
      seat: hit.seat
    });
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
