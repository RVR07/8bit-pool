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
    return res.json().then(function (data) {
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
  if (typeof gui !== 'undefined' && gui) gui.live = this;
  var self = this;
  this.db('/rest/v1/billiards_sessions', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: { id: sessionId }
  }).catch(function () {}).then(function () { self.kick(); });
};

Live.stop = function () {
  this.on = false;
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
    strength: strength,
    angle: ball.aimAngle
  };
  this.shotPending = true;
  if (typeof eightballgame !== 'undefined' && eightballgame) eightballgame.state = 'turnwaiting';
  if (gui && gui.syncHitButton) gui.syncHitButton();
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
    var snap = this.capture();
    if (snap) patch.snapshot = snap;
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
      this.takeShots([row.shot]);
      this.clearShot = true;
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
  return {
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
    pull: cue.cuePull != null ? cue.cuePull : cue.cueGap(),
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
};

Live.takeShots = function (shots) {
  if (!this.host || !shots || !game || !eightballgame) return;
  for (var i = 0; i < shots.length; i++) {
    var shot = shots[i];
    if (!shot || this.applied[shot.id]) continue;
    this.applied[shot.id] = true;
    if (shot.by !== eightballgame.turn) continue;
    if (eightballgame.state !== 'turn') continue;
    var ball = game.balls[0];
    ball.aimAngle = shot.angle;
    ball.cueStrength = shot.strength;
    if (ball.updateGuideLine) ball.updateGuideLine();
    if (ball.aimBlocked) continue;
    eightballgame._remoteShot = true;
    eightballgame.hitButtonClicked(shot.strength);
    eightballgame._remoteShot = false;
  }
};

Live.applySnapshot = function (snap) {
  if (!snap || !game || !game.balls || !snap.balls) return;
  if (this.targets) this.prev = this.targets;
  this.targets = snap.balls;
  this.blendAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  this.clock = {
    left: Number(snap.timer) || 0,
    at: this.blendAt,
    counting: snap.state === 'turn'
  };
  var mine = this.seat === (eightballgame && eightballgame.turn);
  for (var i = 0; i < game.balls.length && i < snap.balls.length; i++) {
    var ball = game.balls[i];
    ball.remote = true;
    ball.remoteMoving = !!snap.moving;
    if (snap.balls[i][7] && ball.name !== 'whiteball') {
      ball.fallen = true;
      ball.mesh.visible = false;
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
  if (!this.sentAt || now - this.sentAt > 40) {
    this.sentAt = now;
    this.sync();
  }
  if (this.host) {
    if (gui && eightballgame && eightballgame.timerLeft) gui.paintClock(eightballgame.timerLeft());
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
  if (!this.targets || !game || !game.balls) return;
  var t = 1;
  if (this.prev && this.prev.length === this.targets.length) {
    t = Math.min(1, ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - this.blendAt) / 50);
  }
  for (var i = 0; i < game.balls.length && i < this.targets.length; i++) {
    var ball = game.balls[i];
    var row = this.targets[i];
    var prev = this.prev && this.prev[i];
    ball.remote = true;
    if (row[7] && ball.name !== 'whiteball') {
      ball.fallen = true;
      ball.mesh.visible = false;
      continue;
    }
    ball.mesh.visible = true;
    var x = row[0];
    var y = row[1];
    var z = row[2];
    if (prev && t < 1) {
      x = prev[0] + (row[0] - prev[0]) * t;
      y = prev[1] + (row[1] - prev[1]) * t;
      z = prev[2] + (row[2] - prev[2]) * t;
    }
    ball.mesh.position.set(x, y, z);
    ball.mesh.quaternion.set(row[3], row[4], row[5], row[6]);
  }
};

function round2(value) {
  return Math.round(value * 100) / 100;
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}
