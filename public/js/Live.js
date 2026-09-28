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
  if (typeof gui !== 'undefined' && gui) gui.live = this;
  this.kick();
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
    self.timer = setTimeout(tick, 50);
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
  if (!this.on || typeof Wallet === 'undefined' || !Wallet.account) return Promise.resolve();
  var body = {
    address: Wallet.account,
    sessionId: this.sessionId,
    ready: true
  };
  if (this.aim && this.myTurn()) body.aim = this.aim;
  if (this.shot) {
    body.shot = this.shot;
    this.shot = null;
  }
  if (this.host) {
    body.snapshot = this.capture();
    body.applied = Object.keys(this.applied);
  }
  return fetch('/api/live', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function (res) { return res.json(); }).then(function (data) {
    if (!self.on || !data || data.error) return;
    self.opponentReady = !!data.opponentReady;
    if (self.opponentReady && !self.announced && gui) {
      self.announced = true;
      gui.log('Opponent connected');
    }
    if (self.host) {
      self.takeShots(data.shots || []);
      self.showOpponentAim(data.aim);
    } else if (data.snapshot) {
      self.applySnapshot(data.snapshot);
    }
  });
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
    timer: eightballgame.timer,
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
  var mine = this.seat === (eightballgame && eightballgame.turn);
  for (var i = 0; i < game.balls.length && i < snap.balls.length; i++) {
    var ball = game.balls[i];
    var row = snap.balls[i];
    if (row[7] && ball.name !== 'whiteball') {
      ball.fallen = true;
      ball.mesh.visible = false;
      continue;
    }
    ball.rigidBody.position.set(row[0], row[1], row[2]);
    ball.rigidBody.quaternion.x = row[3];
    ball.rigidBody.quaternion.y = row[4];
    ball.rigidBody.quaternion.z = row[5];
    ball.rigidBody.quaternion.w = row[6];
    ball.mesh.position.set(row[0], row[1], row[2]);
    ball.mesh.quaternion.set(row[3], row[4], row[5], row[6]);
    ball.rigidBody.velocity.set(0, 0, 0);
    ball.rigidBody.angularVelocity.set(0, 0, 0);
  }
  var cue = game.balls[0];
  if (snap.moving) cue.rigidBody.wakeUp();
  else cue.rigidBody.sleep();
  cue.useRemoteCue = !mine;
  if (!mine) {
    cue.aimAngle = snap.aim;
    cue.cueStrength = snap.strength;
    cue.remotePull = snap.pull;
  }
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

function round2(value) {
  return Math.round(value * 100) / 100;
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}
