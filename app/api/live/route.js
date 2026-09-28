function store() {
  if (!globalThis.__billiardsQueue) {
    globalThis.__billiardsQueue = { waiting: {}, matched: {}, rooms: {} };
  }
  if (!globalThis.__billiardsQueue.rooms) globalThis.__billiardsQueue.rooms = {};
  return globalThis.__billiardsQueue;
}

function clean(address) {
  return String(address || '').trim().toLowerCase();
}

function roomFor(address, roomId) {
  var room = store().rooms[String(roomId || '')];
  if (!room || !room.seats[address]) return null;
  return room;
}

function otherSeat(seat) {
  return seat === 'player1' ? 'player2' : 'player1';
}

export async function POST(request) {
  const body = await request.json().catch(function () { return {}; });
  const address = clean(body.address);
  const sessionId = String(body.sessionId || body.roomId || '');
  const room = roomFor(address, sessionId);
  if (!room) return Response.json({ error: 'No live match' }, { status: 404 });
  const seat = room.seats[address];
  room.at = Date.now();

  if (body.ready) room.ready[seat] = Date.now();

  if (body.aim && Number.isFinite(Number(body.aim.angle))) {
    var strength = Number(body.aim.strength);
    if (!Number.isFinite(strength)) strength = 55;
    strength = Math.max(10, Math.min(100, strength));
    room.aims[seat] = { angle: Number(body.aim.angle), strength: strength, at: Date.now() };
  }

  if (body.shot && body.shot.id && Number.isFinite(Number(body.shot.strength))) {
    var known = false;
    for (var i = 0; i < room.pending.length; i++) {
      if (room.pending[i].id === body.shot.id) known = true;
    }
    if (!known) {
      room.pending.push({
        id: String(body.shot.id),
        by: seat,
        strength: Math.max(10, Math.min(100, Number(body.shot.strength))),
        angle: Number(body.shot.angle) || 0
      });
    }
  }

  if (seat === 'player1' && Array.isArray(body.applied)) {
    room.pending = room.pending.filter(function (shot) {
      return body.applied.indexOf(shot.id) === -1;
    });
  }

  if (seat === 'player1' && body.snapshot && Array.isArray(body.snapshot.balls)) {
    room.snapshot = body.snapshot;
    room.snapshot.at = Date.now();
  }

  var opponent = otherSeat(seat);
  return Response.json({
    seat: seat,
    host: seat === 'player1',
    sessionId: room.sessionId,
    opponentReady: !!room.ready[opponent],
    aim: room.aims[opponent] || null,
    snapshot: room.snapshot,
    shots: seat === 'player1' ? room.pending.slice() : []
  });
}
