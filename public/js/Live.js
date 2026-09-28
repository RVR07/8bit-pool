var Live = {
  on: false,
  sessionId: null,
  seat: null,
  host: false,
  opponentReady: false,
  announced: false,
  aim: null,
  applied: {},
  timer: null
};

Live.dbUrl = 'https://fhmzewpqvblncczeklty.supabase.co';
Live.dbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZobXpld3BxdmJsbmNjemVrbHR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NzgxNjMsImV4cCI6MjEwNTE1NDE2M30.Ur5lTstsobtj5Q0nzxXItTpkZzvzRj5VPoRS2jHWjOc';

Live.db = function (path, options) {
  var headers = {
    apikey: Live.dbKey,
    Authorization: 'Bearer ' + Live.dbKey,
    'Content-Type': 'application/json'
  };
  if (options && options.prefer) headers.Prefer = options.prefer;
  return fetch(Live.dbUrl + path, {
    method: options && options.method ? options.method : 'GET',
    headers: headers,
    body: options && options.body ? JSON.stringify(options.body) : undefined
  }).then(function (res) {
    return res.text().then(function (text) {
      var data = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error((data && (data.message || data.error)) || 'live failed');
      return data;
    });
  });
};

Live.prepare = function (sessionId, seat) {
  this.stop();
  this.on = true;
  this.sessionId = sessionId;
  this.seat = seat === 'player2' ? 'player2' : 'player1';
  this.host = this.seat === 'player1';
  this.opponentReady = false;
  this.announced = false;
  this.aim = null;
  this.applied = {};
  this.sending = false;
  this.again = false;
  this.outSeq = 0;
  this.seenSeq = 0;
  this.predicting = false;
  this.snapInflight = 0;
  this.snapAgain = false;
  if (typeof gui !== 'undefined' && gui) gui.live = this;
  var self = this;
  this.db('/rest/v1/billiards_sessions', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: { id: sessionId }
  }).catch(function () {}).then(function () {
    self.kick();
    self.listen();
  });
};

Live.stop = function () {
  this.on = false;
  this.predicting = false;
  this.unlisten();
  if (this.timer) {
    clearTimeout(this.timer);
    this.timer = null;
  }
  if (typeof gui !== 'undefined' && gui && gui.live === this) gui.live = null;
};

Live.kick = function () {
  var self = this;
  if (this.timer) clearTimeout(this.timer);
  var tick = function () {
    if (!self.on) return;
    self.sync().catch(function () {});
    self.timer = setTimeout(tick, 200);
  };
  tick();
};

Live.noteAim = function (angle, strength) {
  if (!this.on) return;
  this.aim = { angle: angle, strength: strength };
};

Live.sendShot = function (strength) {
  if (!this.on || this.host) return;
  var ball = game && game.balls && game.balls[0];
  if (!ball) return;
  this.aim = { angle: ball.aimAngle, strength: strength };
  this.shot = {
    id: this.seat + '-' + Date.now(),
    by: this.seat,
    strength: strength,
    angle: ball.aimAngle
  };
  this.shotPending = true;
  if (typeof eightballgame !== 'undefined' && eightballgame) eightballgame.state = 'turnwaiting';
  this.beginPredict(strength);
  if (gui && gui.syncHitButton) gui.syncHitButton();
  this.sync();
};

Live.myTurn = function () {
  if (!this.on) return true;
  if (typeof eightballgame === 'undefined' || !eightballgame) return false;
  return this.seat === eightballgame.turn && eightballgame.state === 'turn';
};

Live.sync = function () {
  var self = this;
  if (!this.on || !this.sessionId) return Promise.resolve();
  if (this.sending) {
    this.again = true;
    return Promise.resolve();
  }
  this.sending = true;
  var patch = this.host ? { ready1: true } : { ready2: true };
  if (this.host) {
    if (this.clearShot) {
      patch.shot = null;
      this.clearShot = false;
    }
  } else {
    if (this.aim && this.myTurn()) patch.aim2 = this.aim;
    if (this.shot) {
      patch.shot = this.shot;
      this.shot = null;
    }
  }
  return this.db('/rest/v1/billiards_sessions?id=eq.' + encodeURIComponent(this.sessionId), {
    method: 'PATCH',
    prefer: 'return=representation',
    body: patch
  }).then(function (rows) {
    self.sending = false;
    var row = rows && rows[0];
    if (row) self.consume(row);
    if (self.on && self.again) {
      self.again = false;
      return self.sync();
    }
  }).catch(function () {
    self.sending = false;
  });
};

Live.consume = function (row) {
  if (this.host) {
    this.opponentReady = !!row.ready2;
    if (this.opponentReady && !this.announced && gui) {
      this.announced = true;
      gui.log('Opponent connected');
    }
    if (row.shot && row.shot.id && !this.applied[row.shot.id]) {
      if (this.takeShots([row.shot])) this.clearShot = true;
    }
    this.showOpponentAim(row.aim2);
    return;
  }
  this.opponentReady = !!row.ready1;
  if (this.opponentReady && !this.announced && gui) {
    this.announced = true;
    gui.log('Opponent connected');
  }
  if (row.snapshot && row.snapshot.balls) this.applySnapshot(row.snapshot);
};

Live.capture = function () {
  if (!game || !game.balls || !eightballgame) return null;
  var balls = [];
  var moving = false;
  for (var i = 0; i < game.balls.length; i++) {
    var ball = game.balls[i];
    var body = ball.rigidBody;
    var pos = body.position;
    var quat = body.quaternion;
    if (!ball.fallen && body.sleepState !== CANNON.Body.SLEEPING) moving = true;
    balls.push([
      round2(pos.x), round2(pos.y), round2(pos.z),
      round3(quat.x), round3(quat.y), round3(quat.z), round3(quat.w),
      ball.fallen ? 1 : 0
    ]);
  }
  var cue = game.balls[0];
  this.outSeq = (this.outSeq || 0) + 1;
  return {
    seq: this.outSeq,
    balls: balls,
    moving: moving || !!cue.cueAnimating,
    turn: eightballgame.turn,
    state: eightballgame.state,
    sides: {
      player1: eightballgame.sides.player1,
      player2: eightballgame.sides.player2
    },
    onTable: eightballgame.numbered_balls_on_table.slice(),
    timer: eightballgame.timerLeft ? eightballgame.timerLeft() : (eightballgame.timer || 0),
    aim: cue.aimAngle,
    pull: cue.cueGap(),
    strength: cue.cueStrength,
    gameover: eightballgame.state === 'gameover',
    winner: eightballgame.liveWinner || null
  };
};

Live.showOpponentAim = function (aim) {
  if (!aim || !game || !game.balls || !eightballgame) return;
  if (this.seat === eightballgame.turn) return;
  var ball = game.balls[0];
  if (ball.cueAnimating || ball.rigidBody.sleepState !== CANNON.Body.SLEEPING) return;
  ball.aimAngle = aim.angle;
  ball.cueStrength = aim.strength;
  ball.remotePull = ball.cueGap();
  if (ball.updateGuideLine) ball.updateGuideLine();
  if (!ball.cueAnimating && ball.placeCue) ball.placeCue(ball.remotePull);
};

Live.takeShots = function (shots) {
  if (!this.host || !shots || !game || !eightballgame) return false;
  var done = false;
  for (var i = 0; i < shots.length; i++) {
    var shot = shots[i];
    if (!shot || this.applied[shot.id]) continue;
    if (shot.by !== eightballgame.turn) {
      this.applied[shot.id] = true;
      done = true;
      continue;
    }
    if (eightballgame.state !== 'turn') return false;
    var ball = game.balls[0];
    ball.aimAngle = shot.angle;
    ball.cueStrength = shot.strength;
    if (ball.updateGuideLine) ball.updateGuideLine();
    if (ball.aimBlocked) {
      this.applied[shot.id] = true;
      done = true;
      continue;
    }
    this.applied[shot.id] = true;
    eightballgame._remoteShot = true;
    eightballgame.hitButtonClicked(shot.strength);
    eightballgame._remoteShot = false;
    done = true;
  }
  return done;
};

Live.applySnapshot = function (snap) {
  if (!snap || !game || !game.balls || !snap.balls) return;
  if (snap.seq != null && snap.seq <= this.seenSeq) return;
  if (snap.seq != null) this.seenSeq = snap.seq;
  var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  this.clock = {
    left: Number(snap.timer) || 0,
    at: now,
    counting: snap.state === 'turn'
  };
  if (this.predicting) {
    this.pendingSnap = snap;
    var settled = snap.seq > this.predictSeq && !snap.moving && (snap.state === 'turn' || snap.state === 'gameover' || snap.gameover);
    if (!settled) return;
    this.prev = this.sampleMeshes();
    this.predicting = false;
    this.blendAt = now;
    this.blendMs = 200;
    this.settling = true;
    this.freshBlend = true;
  }
  if (!this.freshBlend) {
    this.prev = this.sampleMeshes();
    var gap = this.lastSnapAt ? now - this.lastSnapAt : 50;
    this.blendMs = Math.max(32, Math.min(gap, 140));
    this.blendAt = now;
  }
  this.freshBlend = false;
  this.lastSnapAt = now;
  this.targets = snap.balls;
  var mine = this.seat === (eightballgame && eightballgame.turn);
  for (var i = 0; i < game.balls.length && i < snap.balls.length; i++) {
    var ball = game.balls[i];
    ball.remote = true;
    ball.remoteMoving = !!snap.moving || !!this.settling;
    if (snap.balls[i][7] && ball.name !== 'whiteball') {
      ball.fallen = true;
      ball.mesh.visible = false;
    } else if (ball.name !== 'whiteball') {
      ball.fallen = false;
    }
  }
  var cue = game.balls[0];
  cue.useRemoteCue = !mine;
  if (!mine) {
    cue.aimAngle = snap.aim;
    cue.cueStrength = snap.strength;
    cue.remotePull = snap.pull;
  }
  this.paintBalls();
  if (!eightballgame) return;
  var accept = !(this.shotPending && snap.turn === this.seat && snap.state === 'turn' && !snap.moving);
  if (accept) this.shotPending = false;
  var changedTurn = eightballgame.turn !== snap.turn;
  var tableKey = snap.onTable.join(',') + '|' + snap.sides.player1 + '|' + snap.sides.player2;
  if (accept) {
    eightballgame.turn = snap.turn;
    eightballgame.state = snap.state;
    eightballgame.sides.player1 = snap.sides.player1;
    eightballgame.sides.player2 = snap.sides.player2;
    eightballgame.numbered_balls_on_table = snap.onTable.slice();
    eightballgame.timer = snap.timer;
  }
  if (accept && (changedTurn || !this.presented) && gui) {
    this.presented = true;
    gui.updateTurn(eightballgame.turn);
  }
  if (accept && gui && tableKey !== this.tableKey) {
    this.tableKey = tableKey;
    gui.updateBalls(eightballgame.numbered_balls_on_table, eightballgame.sides.player1, eightballgame.sides.player2);
  }
  if (accept && gui) gui.UpdateTimer(snap.timer || 0);
  if (accept && snap.gameover && !this.ended) {
    this.ended = true;
    eightballgame.state = 'gameover';
    eightballgame.liveWinner = snap.winner;
    if (gui) gui.showEndGame(snap.winner || 'Player 2');
  }
  if (gui && gui.syncHitButton) gui.syncHitButton();
};

Live.frame = function () {
  if (!this.on) return;
  var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (this.host && (!this.snapAt || now - this.snapAt > 40)) {
    this.snapAt = now;
    this.pushSnap();
  }
  if (!this.sentAt || now - this.sentAt > 100) {
    this.sentAt = now;
    this.sync();
  }
  if (this.host) {
    if (gui && eightballgame && eightballgame.timerLeft) gui.paintClock(eightballgame.timerLeft());
    return;
  }
  if (this.predicting && this.predictAt && now - this.predictAt > 12000) {
    var pending = this.pendingSnap;
    this.predicting = false;
    if (pending) this.applySnapshot(pending);
  }
  if (this.predicting) {
    this.paintGuestClock(now);
    return;
  }
  this.paintBalls();
  this.paintGuestClock(now);
};

Live.paintGuestClock = function (now) {
  if (!this.clock || !gui || !gui.paintClock) return;
  var left = this.clock.left;
  if (this.clock.counting) left -= (now - this.clock.at) / 1000;
  gui.paintClock(left);
};

Live.paintBalls = function () {
  if (this.predicting || !this.targets || !game || !game.balls) return;
  var now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  var t = 1;
  if (this.prev && this.prev.length === this.targets.length) {
    t = (now - this.blendAt) / (this.blendMs || 50);
    if (t < 0) t = 0;
    if (t > 1.12) t = 1.12;
  }
  if (this.settling && t >= 1) this.settling = false;
  for (var i = 0; i < game.balls.length && i < this.targets.length; i++) {
    var ball = game.balls[i];
    var row = this.targets[i];
    var prev = this.prev && this.prev[i];
    ball.remote = true;
    if (this.settling) ball.remoteMoving = true;
    if (row[7] && ball.name !== 'whiteball') {
      ball.fallen = true;
      ball.mesh.visible = false;
      continue;
    }
    if (ball.name !== 'whiteball') ball.fallen = false;
    ball.mesh.visible = true;
    var x = row[0];
    var y = row[1];
    var z = row[2];
    if (prev && t < 1) {
      x = prev[0] + (row[0] - prev[0]) * t;
      y = prev[1] + (row[1] - prev[1]) * t;
      z = prev[2] + (row[2] - prev[2]) * t;
      var qa = this.qa || (this.qa = new THREE.Quaternion());
      var qb = this.qb || (this.qb = new THREE.Quaternion());
      qa.set(prev[3], prev[4], prev[5], prev[6]);
      qb.set(row[3], row[4], row[5], row[6]);
      ball.mesh.quaternion.copy(qa).slerp(qb, t);
    } else {
      ball.mesh.quaternion.set(row[3], row[4], row[5], row[6]);
    }
    ball.mesh.position.set(x, y, z);
  }
};

Live.pushSnap = function () {
  if (!this.on || !this.host || !this.sessionId) return;
  if (this.snapInflight >= 3) {
    this.snapAgain = true;
    return;
  }
  var snap = this.capture();
  if (!snap) return;
  this.snapInflight++;
  var self = this;
  this.db('/rest/v1/rpc/billiards_snap', {
    method: 'POST',
    prefer: 'return=minimal',
    body: { p_id: this.sessionId, p_snapshot: snap }
  }).then(function () {
    self.snapInflight--;
    if (self.on && self.snapAgain) {
      self.snapAgain = false;
      self.pushSnap();
    }
  }).catch(function () {
    self.snapInflight--;
  });
};

Live.beginPredict = function (strength) {
  if (!game || !game.balls || !game.balls[0]) return;
  var cue = game.balls[0];
  if (cue.aimBlocked || cue.cueAnimating) return;
  this.plantBodies();
  if (cue.rigidBody.sleepState !== CANNON.Body.SLEEPING) cue.rigidBody.sleep();
  game.ballHit(strength);
  if (!cue.cueAnimating) {
    this.releasePredict();
    return;
  }
  this.predicting = true;
  this.predictSeq = this.seenSeq || 0;
  this.predictAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  this.pendingSnap = null;
};

Live.releasePredict = function () {
  this.predicting = false;
  if (!game || !game.balls) return;
  for (var i = 0; i < game.balls.length; i++) game.balls[i].remote = true;
};

Live.plantBodies = function () {
  for (var i = 0; i < game.balls.length; i++) {
    var ball = game.balls[i];
    var body = ball.rigidBody;
    var p = ball.mesh.position;
    var q = ball.mesh.quaternion;
    var y = (ball.fallen && ball.name !== 'whiteball') ? -80 : p.y;
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.position.set(p.x, y, p.z);
    if (body.previousPosition) body.previousPosition.set(p.x, y, p.z);
    body.quaternion.x = q.x;
    body.quaternion.y = q.y;
    body.quaternion.z = q.z;
    body.quaternion.w = q.w;
    ball.remote = false;
    ball.remoteMoving = false;
    body.sleep();
  }
};

Live.sampleMeshes = function () {
  var out = [];
  if (!game || !game.balls) return out;
  for (var i = 0; i < game.balls.length; i++) {
    var ball = game.balls[i];
    var p = ball.mesh.position;
    var q = ball.mesh.quaternion;
    out.push([p.x, p.y, p.z, q.x, q.y, q.z, q.w, ball.fallen && ball.name !== 'whiteball' ? 1 : 0]);
  }
  return out;
};

Live.listen = function () {
  this.unlisten();
  if (!this.on || !this.sessionId || typeof WebSocket === 'undefined') return;
  var self = this;
  var url = this.dbUrl.replace('https://', 'wss://') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(this.dbKey) + '&vsn=1.0.0';
  var ws = new WebSocket(url);
  this.socket = ws;
  var ref = 0;
  ws.onopen = function () {
    var joinRef = String(++ref);
    ws.send(JSON.stringify({
      topic: 'realtime:billiards:' + self.sessionId,
      event: 'phx_join',
      payload: {
        config: {
          broadcast: { ack: false, self: false },
          presence: { key: '' },
          postgres_changes: [{
            event: '*',
            schema: 'public',
            table: 'billiards_sessions',
            filter: 'id=eq.' + self.sessionId
          }]
        },
        access_token: self.dbKey
      },
      ref: joinRef,
      join_ref: joinRef
    }));
    self.pulse = setInterval(function () {
      if (!self.socket || self.socket.readyState !== 1) return;
      self.socket.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }));
    }, 25000);
  };
  ws.onmessage = function (event) {
    var msg;
    try { msg = JSON.parse(event.data); } catch (e) { return; }
    if (!msg || msg.event !== 'postgres_changes') return;
    var row = liveRow(msg.payload);
    if (row && row.id === self.sessionId) self.consume(row);
  };
  ws.onclose = function () {
    if (self.pulse) {
      clearInterval(self.pulse);
      self.pulse = null;
    }
    if (!self.on || self.socket !== ws) return;
    self.socket = null;
    setTimeout(function () { if (self.on) self.listen(); }, 1000);
  };
};

Live.unlisten = function () {
  if (this.pulse) {
    clearInterval(this.pulse);
    this.pulse = null;
  }
  if (!this.socket) return;
  var ws = this.socket;
  this.socket = null;
  ws.onclose = null;
  try { ws.close(); } catch (e) {}
};

function liveRow(payload) {
  var data = payload && (payload.data || payload);
  var row = data && (data.record || data.new || null);
  if (!row || !row.id) return null;
  if (typeof row.snapshot === 'string') {
    try { row.snapshot = JSON.parse(row.snapshot); } catch (e) { row.snapshot = null; }
  }
  if (typeof row.shot === 'string') {
    try { row.shot = JSON.parse(row.shot); } catch (e) { row.shot = null; }
  }
  if (typeof row.aim2 === 'string') {
    try { row.aim2 = JSON.parse(row.aim2); } catch (e) { row.aim2 = null; }
  }
  return row;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}
