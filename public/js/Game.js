// constructor function
var Game = function () {
  this.table = new Table();
  //TODO write a nice thing for automatically positioning the balls instead of this hardcoded crap?
  var X_offset = Table.LEN_X / 4;
  var X_offset_2 = 1.72; // this controls how tightly the balls are packed together on the x-axis

  this.balls = [
    new WhiteBall(),

    // First row
    new Ball(X_offset, Ball.RADIUS, 4 * Ball.RADIUS, '4ball'),
    new Ball(X_offset, Ball.RADIUS, 2 * Ball.RADIUS, '3ball'),
    new Ball(X_offset, Ball.RADIUS, 0, '14ball'),
    new Ball(X_offset, Ball.RADIUS, -2 * Ball.RADIUS, '2ball'),
    new Ball(X_offset, Ball.RADIUS, -4 * Ball.RADIUS, '15ball'),

    // 2nd row
    new Ball(X_offset - X_offset_2 * Ball.RADIUS, Ball.RADIUS, 3 * Ball.RADIUS, '13ball'),
    new Ball(X_offset - X_offset_2 * Ball.RADIUS, Ball.RADIUS, Ball.RADIUS, '7ball'),
    new Ball(X_offset - X_offset_2 * Ball.RADIUS, Ball.RADIUS, -1 * Ball.RADIUS, '12ball'),
    new Ball(X_offset - X_offset_2 * Ball.RADIUS, Ball.RADIUS, -3 * Ball.RADIUS, '5ball'),

    // 3rd row
    new Ball(X_offset - X_offset_2 * 2 * Ball.RADIUS, Ball.RADIUS, 2 * Ball.RADIUS, '6ball'),
    new Ball(X_offset - X_offset_2 * 2 * Ball.RADIUS, Ball.RADIUS, 0, '8ball'),
    new Ball(X_offset - X_offset_2 * 2 * Ball.RADIUS, Ball.RADIUS, -2 * Ball.RADIUS, '9ball'),

    //4th row
    new Ball(X_offset - X_offset_2 * 3 * Ball.RADIUS, Ball.RADIUS, Ball.RADIUS, '10ball'),
    new Ball(X_offset - X_offset_2 * 3 * Ball.RADIUS, Ball.RADIUS, -1 * Ball.RADIUS, '11ball'),

    //5th row
    new Ball(X_offset - X_offset_2 * 4 * Ball.RADIUS, Ball.RADIUS, 0, '1ball')
  ];

  this.listenForHits();
}

Game.prototype.placeBody = function (ball, x, y, z) {
  ball.rigidBody.velocity.set(0, 0, 0);
  ball.rigidBody.angularVelocity.set(0, 0, 0);
  ball.rigidBody.position.set(x, y, z);
  ball.rigidBody.sleep();
  ball.mesh.position.set(x, y, z);
};

Game.prototype.showMenuPose = function () {
  var cueBall = this.balls[0];
  if (!cueBall.menuHome) {
    cueBall.menuHome = {
      x: cueBall.rigidBody.position.x,
      y: cueBall.rigidBody.position.y,
      z: cueBall.rigidBody.position.z
    };
  }
  this.placeBody(cueBall, 0, Ball.RADIUS, 0);
  cueBall.showcase = true;
  cueBall.hideGuides();
  cueBall.placeShowcaseCue();
};

Game.prototype.restorePlayPose = function () {
  var cueBall = this.balls[0];
  var home = cueBall.menuHome;
  if (home) {
    this.placeBody(cueBall, home.x, home.y, home.z);
  }
  cueBall.showcase = false;
  cueBall.aimLocked = false;
  cueBall.aimAngle = Math.PI / 2;
  cueBall.forward.set(0, 0, -1);

  for (var i = 1; i < this.balls.length; i++) {
    this.balls[i].mesh.visible = true;
  }
};

Game.prototype.tick = function (dt) {
  for (var i in this.balls) {
    this.balls[i].tick(dt);
  }
};

/** Hit the ball with the given strength. This
 will make the ball move towards it's current "forward" direction, which
 is determined by the camera position / angle */
Game.prototype.ballHit = function (strength) {
  var ball = this.balls[0];
  if (ball.aimBlocked || ball.rigidBody.sleepState != CANNON.Body.SLEEPING || ball.cueAnimating) return;
  ball.strokeCue(strength, function () {
    ball.hitForward(strength);
    if (typeof Sound !== 'undefined') Sound.cue(strength);
  });
};

Game.prototype.listenForHits = function () {
  var byId = {};
  var balls = this.balls;
  var recent = {};
  for (var i = 0; i < balls.length; i++) byId[balls[i].rigidBody.id] = balls[i];

  function onCollide(event) {
    var other = byId[event.body && event.body.id];
    var self = byId[event.target && event.target.id];
    if (!self || !other || self.rigidBody.id > other.rigidBody.id) return;
    if (typeof eightballgame === 'undefined' || !eightballgame) return;
    if (eightballgame.state !== 'turnwaiting' && eightballgame.state !== 'turn') return;
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var key = self.name + ':' + other.name;
    if (recent[key] && now - recent[key] < 50) return;
    recent[key] = now;
    var speed = 0;
    if (event.contact && event.contact.getImpactVelocityAlongNormal) {
      speed = Math.abs(event.contact.getImpactVelocityAlongNormal());
    }
    if (typeof Sound !== 'undefined') Sound.balls(speed, self.name === '8ball' || other.name === '8ball');
  }

  for (var j = 0; j < balls.length; j++) {
    balls[j].rigidBody.addEventListener('collide', onCollide);
  }
};
