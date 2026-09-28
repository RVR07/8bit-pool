var WhiteBall = function (x, y, z) {
  this.color = 0xffffff;
  this.defaultPosition = new CANNON.Vec3(-Table.LEN_X / 4, Ball.RADIUS, 0);
  // Call the parent constructor, making sure (using Function#call)
  // that "this" is set correctly during the call
  Ball.call(
    this,
    this.defaultPosition.x,
    this.defaultPosition.y,
    this.defaultPosition.z,
    'whiteball',
    this.color
  );

  this.forward = new THREE.Vector3(0, 0, -1);
  this.aimAngle = Math.PI / 2;
  this.aimLocked = false;
  this.cueStrength = 55;
  this.cueAnimating = false;
  this.showcase = false;
  this.cue = this.createCue();
  scene.add(this.cue);
  this.forwardLine = this.createGuideLine(0xffffff, 1.35);
  this.forwardCap = this.createCap(0xffffff, 0.68);
  scene.add(this.forwardLine);
  scene.add(this.forwardCap);

  this.objectLine = this.createGuideLine(0x5ef2c5, 1.15);
  this.objectCap = this.createCap(0x5ef2c5, 0.58);
  scene.add(this.objectLine);
  scene.add(this.objectCap);
  var savedStyle = WhiteBall.cueById(this.cueId);
  if (savedStyle && savedStyle.line) this.setGuideColor(savedStyle.line);

  this.hitSphere = new THREE.Sphere(new THREE.Vector3(), Ball.RADIUS * 2);
  this.ghostPoint = new THREE.Vector3();
  this.savedGhost = new THREE.Vector3();
  this.lineEnd = new THREE.Vector3();
  this.objectDir = new THREE.Vector3();
  this.objectRay = new THREE.Ray();
  this.cushionPoint = new THREE.Vector3();

  this.dot = this.createIntersectionDot();
  scene.add(this.dot);
};

WhiteBall.prototype = Object.create(Ball.prototype);
WhiteBall.prototype.constructor = WhiteBall;

/** Applies a force to this ball to make it move.
    The strength of the force is given by the argument
    The force is the balls "forward" vector, applied at the
    edge of the ball in the opposite direction of the "forward"
*/
WhiteBall.prototype.hitForward = function (strength) {
  this.rigidBody.wakeUp();
  var ballPoint = new CANNON.Vec3();
  ballPoint.copy(this.rigidBody.position);

  var vec = new CANNON.Vec3();
  vec.copy(this.forward);

  vec.normalize();
  vec.scale(Ball.RADIUS, vec);
  ballPoint.vsub(vec, ballPoint);

  var force = new CANNON.Vec3();
  force.copy(this.forward.normalize());
  force.scale(strength, force);
  this.rigidBody.applyImpulse(force, ballPoint);
};

/** Resets the position to this.defaultPosition */
WhiteBall.prototype.onEnterHole = function () {
  this.rigidBody.velocity = new CANNON.Vec3(0);
  this.rigidBody.angularVelocity = new CANNON.Vec3(0);
  this.rigidBody.position.copy(this.defaultPosition);
  eightballgame.whiteBallEnteredHole();
};

WhiteBall.prototype.tick = function (dt) {
  //Superclass tick behaviour:
  Ball.prototype.tick.apply(this, arguments);

  if (this.showcase) {
    this.hideGuides();
    if (this.cueOnOverlay) return;
    this.tickCueFade();
    this.placeShowcaseCue();
    return;
  }

  //update intersection dot if were not moving
  if (this.rigidBody.sleepState == CANNON.Body.SLEEPING) {
    if (!this.forwardLine.visible) {
      this.forwardLine.visible = true;
    }
    if (!this.dot.visible) {
      this.dot.visible = true;
    }
    this.updateGuideLine();
    this.updateIntersectionDot();
    if (!this.cueAnimating) {
      this.placeCue(this.cueGap());
    }
  } else {
    if (this.forwardLine.visible) {
      this.forwardLine.visible = false;
    }
    if (this.objectLine.visible) {
      this.objectLine.visible = false;
    }
    if (this.forwardCap.visible) {
      this.forwardCap.visible = false;
    }
    if (this.objectCap.visible) {
      this.objectCap.visible = false;
    }
    if (this.dot.visible) {
      this.dot.visible = false;
    }
    if (!this.cueAnimating && this.cue.visible) {
      this.cue.visible = false;
    }
  }
};

/** How far the cue sits behind the ball. Higher strength pulls it further back. */
WhiteBall.prototype.cueGap = function () {
  var t = (this.cueStrength - 10) / 90;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return 1.4 + t * 24;
};

WhiteBall.prototype.hideGuides = function () {
  this.forwardLine.visible = false;
  this.forwardCap.visible = false;
  this.objectLine.visible = false;
  this.objectCap.visible = false;
  this.dot.visible = false;
};

/** Cue laid beside the ball for the home screen, not aimed for a shot. */
WhiteBall.prototype.placeShowcaseCue = function () {
  var lift = this.cueLift || 0;
  var eased = lift * lift * (3 - 2 * lift);
  var angle = Math.PI / 2;
  var tipX = Math.cos(angle);
  var tipZ = -Math.sin(angle);
  var half = 73.35;
  var restX = -Table.LEN_X / 4 + tipX * half;
  var restZ = tipZ * half;
  var restY = Ball.RADIUS + 4;
  var height = (typeof CAMERA_HEIGHT === 'number' ? CAMERA_HEIGHT : 250);
  var hoverY = height * 0.34;
  this.cue.visible = true;
  this.cue.position.set(
    restX + (half - restX) * eased,
    restY + (hoverY - restY) * eased,
    restZ + (-18 - restZ) * eased
  );
  this.cue.rotation.set(-0.42 * eased, angle + (0 - angle) * eased, 0);
  this.cue.scale.set(1, 1, 1);
  this.setCueOpacity(1);
};

WhiteBall.overlay = function () {
  if (WhiteBall._overlay) return WhiteBall._overlay;
  var canvas = document.createElement('canvas');
  canvas.id = 'cueLayer';
  document.getElementById('overlay').appendChild(canvas);
  var gl = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  gl.setClearColor(0x000000, 0);
  gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  var cueScene = new THREE.Scene();
  cueScene.add(new THREE.AmbientLight(0x9aa0a6));
  var key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(30, 80, 40);
  cueScene.add(key);
  var cueCamera = new THREE.PerspectiveCamera(26, 1, 1, 800);
  cueCamera.position.set(0, 72, 320);
  cueCamera.lookAt(new THREE.Vector3(0, 0, 0));
  WhiteBall._overlay = { canvas: canvas, renderer: gl, scene: cueScene, camera: cueCamera, active: false };
  WhiteBall.resizeOverlay();
  return WhiteBall._overlay;
};

WhiteBall.resizeOverlay = function () {
  var overlay = WhiteBall._overlay;
  if (!overlay) return;
  var width = window.innerWidth;
  var height = window.innerHeight;
  if (height < 1) height = 1;
  overlay.renderer.setSize(width, height);
  overlay.camera.aspect = width / height;
  overlay.camera.updateProjectionMatrix();
};

/** Draw the cue on its own layer, above the faded table. */
WhiteBall.prototype.showCueOverlay = function () {
  var overlay = WhiteBall.overlay();
  overlay.scene.add(this.cue);
  this.cueOnOverlay = true;
  overlay.active = true;
  this.cue.visible = true;
  this.cue.position.set(73.35, 0, 0);
  this.cue.rotation.set(-0.55, 0, 0);
  this.cue.scale.set(1, 1, 1);
  this.setCueOpacity(1);
  overlay.canvas.className = 'is-on';
  WhiteBall.resizeOverlay();
};

WhiteBall.prototype.hideCueOverlay = function () {
  if (!this.cueOnOverlay) return;
  var overlay = WhiteBall._overlay;
  this.cueOnOverlay = false;
  this.cueLift = 0;
  if (overlay) {
    overlay.active = false;
    overlay.canvas.className = '';
  }
  scene.add(this.cue);
};

/** Place the cue behind the ball, opposite the white aim line. */
WhiteBall.prototype.placeCue = function (gap) {
  this.cue.visible = true;
  this.cueLift = 0;
  this.cueLifting = false;
  this.cue.scale.set(1, 1, 1);
  this.cue.rotation.x = 0;
  this.cue.rotation.z = 0;
  this.setCueOpacity(1);
  this.cue.position.copy(this.mesh.position);
  this.cue.position.x -= this.forward.x * (Ball.RADIUS + gap);
  this.cue.position.z -= this.forward.z * (Ball.RADIUS + gap);
  this.cue.position.y = this.mesh.position.y + 4;
  this.cue.rotation.y = this.aimAngle;
};

/** Visual stroke only. The impulse is applied when the tip arrives. */
WhiteBall.prototype.strokeCue = function (strength, onContact) {
  this.cueStrength = strength;
  this.cueAnimating = true;
  var from = this.cueGap();
  var to = 0.2;
  var duration = 240 - strength * 1.1;
  var start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  var self = this;

  function step(now) {
    var t = (now - start) / duration;
    if (t > 1) t = 1;
    var eased = t * t;
    self.placeCue(from + (to - from) * eased);
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      self.cueAnimating = false;
      onContact();
    }
  }

  requestAnimationFrame(step);
};

WhiteBall.CUES = [
  { id: 'classic', name: 'Classic', line: 0x4d94ff, tip: 0x2f6fbe, ferrule: 0xf4f4f4, shaft: 0xe7c99a, ring: 0xd4b06a, wrap: 0x2a2a2a, butt: 0x6a3d22, bumper: 0x111111, maps: { tip: 'leather', ferrule: 'ivory', shaft: 'maple', ring: 'metal', wrap: 'linen', butt: 'walnut' }, shine: { shaft: 78, butt: 64, ring: 110, ferrule: 70 } },
  { id: 'ebony', name: 'Ebony', line: 0xe4e4e4, tip: 0xe8e8e8, ferrule: 0xf7f7f7, shaft: 0x3a342e, ring: 0xd8d8d8, wrap: 0x1a1a1a, butt: 0x241e1a, bumper: 0x0c0c0c, maps: { tip: 'leather', ferrule: 'ivory', shaft: 'ebony', ring: 'metal', wrap: 'linen', butt: 'ebony' }, shine: { shaft: 86, butt: 80, ring: 120 } },
  { id: 'rosewood', name: 'Rosewood', line: 0xff7a62, tip: 0xc45a4a, ferrule: 0xf6f1ea, shaft: 0xc46a48, ring: 0xe0b070, wrap: 0x4a2a22, butt: 0x8a4030, bumper: 0x1a100e, maps: { tip: 'leather', ferrule: 'ivory', shaft: 'rosewood', ring: 'metal', wrap: 'linen', butt: 'rosewood' }, shine: { shaft: 72, butt: 60, ring: 100 } },
  { id: 'ivory', name: 'Ivory', line: 0xe8c56a, tip: 0xc9a15b, ferrule: 0xfffaf2, shaft: 0xf4ead8, ring: 0xe6d3a1, wrap: 0xe8dcc6, butt: 0xddc9a4, bumper: 0xbfae90, maps: { tip: 'leather', ferrule: 'ivory', shaft: 'maple', ring: 'metal', wrap: 'linen', butt: 'maple' }, shine: { shaft: 84, butt: 70, ring: 110 } },
  { id: 'cobalt', name: 'Cobalt', line: 0x6aa6ff, tip: 0x3d7dff, ferrule: 0xf4f7ff, shaft: 0x8eb6ff, ring: 0xd6e6ff, wrap: 0x1a2744, butt: 0x2a3d66, bumper: 0x101820, maps: { shaft: 'lacquer', ring: 'metal', wrap: 'carbon', butt: 'lacquer' }, shine: { shaft: 120, butt: 110, ring: 130, wrap: 40 } },
  { id: 'crimson', name: 'Crimson', line: 0xff5c5e, tip: 0xc4383a, ferrule: 0xf8f4f4, shaft: 0xe07070, ring: 0xf0c0b0, wrap: 0x3a1618, butt: 0x8a3030, bumper: 0x140c0c, maps: { shaft: 'lacquer', ring: 'metal', wrap: 'linen', butt: 'lacquer' }, shine: { shaft: 120, butt: 100, ring: 120 } },
  { id: 'carbon', name: 'Carbon', line: 0xff5a32, tip: 0xff5530, ferrule: 0xf2f2f2, shaft: 0xffffff, ring: 0xff4428, wrap: 0xffffff, butt: 0xffffff, bumper: 0x111111, maps: { shaft: 'carbon', ring: 'metal', wrap: 'carbon', butt: 'carbon' }, shine: { shaft: 90, wrap: 70, butt: 90, ring: 130 }, swatch: { shaft: 'repeating-linear-gradient(45deg,#1c1e22 0 3px,#3a3e46 3px 4px)', wrap: 'repeating-linear-gradient(-45deg,#16181c 0 3px,#3a3e46 3px 4px)', butt: 'repeating-linear-gradient(45deg,#14161a 0 3px,#2e3238 3px 4px)' } },
  { id: 'candy', name: 'Candy', line: 0xff4d8d, tip: 0xff4d8d, ferrule: 0xffffff, shaft: 0xffffff, ring: 0xffe14a, wrap: 0xffffff, butt: 0xffffff, bumper: 0x1a1020, maps: { shaft: 'candy', wrap: 'candy', butt: 'candy' }, shine: { shaft: 130, wrap: 90, butt: 120, ring: 140 }, swatch: { shaft: 'repeating-linear-gradient(#ff4d8d 0 5px,#ffe14a 5px 10px,#3dffe0 10px 15px,#7a5cff 15px 20px)', wrap: 'repeating-linear-gradient(90deg,#ff4d8d 0 4px,#3dffe0 4px 8px)', butt: 'repeating-linear-gradient(#7a5cff 0 5px,#ff4d8d 5px 10px,#ffe14a 10px 15px)' } },
  { id: 'marble', name: 'Marble', line: 0xe6c56a, tip: 0xc9a15b, ferrule: 0xf7f7f7, shaft: 0xffffff, ring: 0xe6c56a, wrap: 0xd8d4ce, butt: 0xffffff, bumper: 0x222222, maps: { ferrule: 'ivory', shaft: 'marble', ring: 'metal', wrap: 'linen', butt: 'marble' }, shine: { shaft: 100, butt: 96, ring: 130 }, swatch: { shaft: 'radial-gradient(circle at 30% 20%,#fff,#d9d4cc 40%,#9a9590 70%,#f4f1ec)', butt: 'radial-gradient(circle at 70% 30%,#f7f4ef,#c8c2ba 50%,#8d8882)' } },
  { id: 'flame', name: 'Flame', line: 0xff7a24, tip: 0xff6a1a, ferrule: 0xf6e6c8, shaft: 0xffffff, ring: 0xffb020, wrap: 0x2a140c, butt: 0xffffff, bumper: 0x140c08, maps: { shaft: 'flame', ring: 'metal', wrap: 'linen', butt: 'flame' }, shine: { shaft: 88, butt: 70, ring: 120 }, swatch: { shaft: 'repeating-linear-gradient(90deg,#e8a04a 0 3px,#8a3a14 3px 5px,#f0c070 5px 8px)', butt: 'repeating-linear-gradient(90deg,#c47830 0 3px,#5a2410 3px 6px,#e8a04a 6px 8px)' } },
  { id: 'viper', name: 'Viper', line: 0xc6f24a, tip: 0xb6ff3a, ferrule: 0xf4f7f0, shaft: 0x1c2a18, ring: 0xd6ff4a, wrap: 0xffffff, butt: 0x24321c, bumper: 0x10140e, maps: { shaft: 'lacquer', ring: 'metal', wrap: 'viper', butt: 'ebony' }, shine: { shaft: 100, wrap: 36, butt: 50, ring: 130 }, swatch: { wrap: 'repeating-linear-gradient(125deg,#1a2414 0 4px,#6a8a32 4px 6px,#dfe8b0 6px 7px,#243018 7px 11px)' } },
  { id: 'galaxy', name: 'Galaxy', line: 0xd48cff, tip: 0xff4ad8, ferrule: 0xf4f0ff, shaft: 0xffffff, ring: 0xc8a0ff, wrap: 0x140818, butt: 0xffffff, bumper: 0x08040e, maps: { shaft: 'galaxy', ring: 'metal', wrap: 'galaxy', butt: 'galaxy' }, shine: { shaft: 110, butt: 100, wrap: 40, ring: 130 }, swatch: { shaft: 'radial-gradient(circle at 30% 40%,#fff 0 1px,transparent 2px),radial-gradient(circle at 70% 60%,#7ad0ff 0 1px,transparent 2px),linear-gradient(#1a0830,#3a1468)', butt: 'radial-gradient(circle at 40% 30%,#fff 0 1px,transparent 2px),linear-gradient(#12061f,#5a2080)', wrap: 'linear-gradient(#0c0414,#2a1040)' } },
  { id: 'pearl', name: 'Pearl', line: 0xf2c14e, tip: 0xf2c14e, ferrule: 0xfffaf2, shaft: 0xffffff, ring: 0xf0e2b0, wrap: 0xffffff, butt: 0xffffff, bumper: 0xc8beb0, maps: { ferrule: 'ivory', shaft: 'pearl', ring: 'metal', wrap: 'pearl', butt: 'pearl' }, shine: { shaft: 130, wrap: 90, butt: 120, ring: 140 }, swatch: { shaft: 'linear-gradient(#f7e8ef,#d7f3ea,#f3e7c4,#e7d4f7)', wrap: 'linear-gradient(90deg,#f7e8ef,#d7f3ea,#f3e7c4)', butt: 'linear-gradient(#e7d4f7,#f7e8ef,#d7f3ea)' } },
  { id: 'tiger', name: 'Tiger', line: 0xffb000, tip: 0xffb000, ferrule: 0xfff6e4, shaft: 0xffffff, ring: 0xffd060, wrap: 0x1a1208, butt: 0xffffff, bumper: 0x140e08, maps: { shaft: 'tiger', ring: 'metal', wrap: 'linen', butt: 'tiger' }, shine: { shaft: 70, butt: 54, ring: 110 }, swatch: { shaft: 'repeating-linear-gradient(#f0a020 0 6px,#1a120c 6px 9px,#e88810 9px 14px)', butt: 'repeating-linear-gradient(#d88818 0 5px,#1a1008 5px 8px,#f0a020 8px 12px)' } },
  { id: 'check', name: 'Check', line: 0xf4f4f4, tip: 0x111111, ferrule: 0xffffff, shaft: 0xf7f7f7, ring: 0x111111, wrap: 0xffffff, butt: 0xffffff, bumper: 0x111111, maps: { ferrule: 'ivory', shaft: 'lacquer', ring: 'metal', wrap: 'check', butt: 'check' }, shine: { shaft: 100, wrap: 20, butt: 30, ring: 80 }, swatch: { wrap: 'repeating-conic-gradient(#111 0% 25%,#f2f2f2 0% 50%)', butt: 'repeating-conic-gradient(#111 0% 25%,#f4f4f4 0% 50%)' } }
];

WhiteBall.cueById = function (id) {
  for (var i = 0; i < WhiteBall.CUES.length; i++) {
    if (WhiteBall.CUES[i].id === id) return WhiteBall.CUES[i];
  }
  return WhiteBall.CUES[0];
};

WhiteBall.prototype.createCue = function () {
  var cue = new THREE.Object3D();
  var pieces = [
    { length: 4, radiusTop: 0.7, radiusBottom: 0.85, color: 0x2f6fbe, shininess: 30 },
    { length: 6.3, radiusTop: 0.85, radiusBottom: 0.95, color: 0xf4f4f4, shininess: 50 },
    { length: 80, radiusTop: 0.95, radiusBottom: 1.25, color: 0xe2c48a, shininess: 25 },
    { length: 4, radiusTop: 1.28, radiusBottom: 1.4, color: 0xc9a15b, shininess: 60 },
    { length: 23, radiusTop: 1.45, radiusBottom: 1.55, color: 0x1c1c1c, shininess: 15 },
    { length: 26, radiusTop: 1.55, radiusBottom: 1.75, color: 0x5a3218, shininess: 20 },
    { length: 3.4, radiusTop: 1.7, radiusBottom: 1.5, color: 0x111111, shininess: 10 }
  ];

  var xTip = 0;
  for (var i = 0; i < pieces.length; i++) {
    var piece = pieces[i];
    var mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(piece.radiusTop, piece.radiusBottom, piece.length, 16),
      new THREE.MeshPhongMaterial({
        color: piece.color,
        shininess: piece.shininess,
        specular: 0x333333
      })
    );
    mesh.rotation.z = -Math.PI / 2;
    mesh.position.set(xTip - piece.length / 2, 0, 0);
    mesh.castShadow = true;
    cue.add(mesh);
    xTip -= piece.length;
  }

  cue.visible = false;
  var saved = 'classic';
  try { saved = localStorage.getItem('billiards-cue') || 'classic'; } catch (err) {}
  this.cue = cue;
  this.cueOpacity = 1;
  this.applyCue(saved);
  return cue;
};

WhiteBall.MAP_REPEAT = {
  leather: 1, ivory: 1, maple: 4, walnut: 3, rosewood: 3, ebony: 4, lacquer: 3,
  carbon: 2, candy: 1, marble: 1, flame: 2, viper: 3, galaxy: 1, pearl: 2,
  tiger: 2, linen: 4, check: 2, metal: 2
};

WhiteBall.cueTexture = function (name) {
  if (!WhiteBall._textures) WhiteBall._textures = {};
  if (WhiteBall._textures[name]) return WhiteBall._textures[name];
  var canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  var ctx = canvas.getContext('2d');
  WhiteBall.paintCueTexture(ctx, canvas.width, canvas.height, name);
  var tex = new THREE.Texture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  WhiteBall._textures[name] = tex;
  return tex;
};

WhiteBall.paintCueTexture = function (ctx, w, h, name) {
  var rand = WhiteBall.seeded(name.length * 97 + name.charCodeAt(0) * 13);
  function wood(base, line, dark) {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    if (WhiteBall.woodImage && WhiteBall.woodImage.complete && WhiteBall.woodImage.naturalWidth) {
      ctx.save();
      ctx.translate(w, 0);
      ctx.rotate(Math.PI / 2);
      ctx.globalAlpha = 0.72;
      ctx.drawImage(WhiteBall.woodImage, 0, 0, h, w);
      ctx.restore();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    for (var i = 0; i < 22; i++) {
      ctx.strokeStyle = i % 4 === 0 ? dark : line;
      ctx.globalAlpha = 0.18 + rand() * 0.4;
      ctx.lineWidth = 0.6 + rand() * 2.2;
      ctx.beginPath();
      var x = (i + 0.5) / 22 * w;
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 10 * (rand() - 0.5), h * 0.35, x + 14 * (rand() - 0.5), h * 0.7, x + 6 * (rand() - 0.5), h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function gloss() {
    var grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.42, 'rgba(255,255,255,0.28)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.58, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  if (name === 'maple') wood('#f3e6c8', '#c8a56a', '#8a6230');
  else if (name === 'walnut') wood('#8a5a32', '#4a2c18', '#2a160e');
  else if (name === 'rosewood') wood('#c46a48', '#7a3028', '#3a1414');
  else if (name === 'ebony') wood('#3a342e', '#1a1614', '#0c0c0c');
  else if (name === 'lacquer') {
    wood('#f4f4f4', '#d0d0d0', '#9a9a9a');
    gloss();
  } else if (name === 'ivory') {
    ctx.fillStyle = '#f7f1e6';
    ctx.fillRect(0, 0, w, h);
    for (var n = 0; n < 400; n++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(180,160,120,0.18)';
      ctx.fillRect(rand() * w, rand() * h, 2, 2 + rand() * 6);
    }
  } else if (name === 'leather') {
    ctx.fillStyle = '#2a4a78';
    ctx.fillRect(0, 0, w, h);
    for (var p = 0; p < 180; p++) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * h, 1.2 + rand() * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (name === 'linen') {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    for (var y = 0; y < h; y += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (var x = 0; x < w; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  } else if (name === 'metal') {
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(0, 0, w, h);
    for (var m = 0; m < h; m += 2) {
      ctx.fillStyle = m % 4 === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, m, w, 1);
    }
    gloss();
  } else if (name === 'carbon') {
    ctx.fillStyle = '#16181c';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#3c414a';
    ctx.lineWidth = 2;
    for (var c = -h; c < w + h; c += 7) {
      ctx.beginPath();
      ctx.moveTo(c, 0);
      ctx.lineTo(c + h, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c, h);
      ctx.lineTo(c + h, 0);
      ctx.stroke();
    }
  } else if (name === 'candy') {
    var bands = ['#ff4d8d', '#ffe14a', '#3dffe0', '#7a5cff', '#ffffff'];
    var bh = h / (bands.length * 2);
    for (var b = 0; b < bands.length * 2; b++) {
      ctx.fillStyle = bands[b % bands.length];
      ctx.fillRect(0, b * bh, w, bh + 1);
    }
    gloss();
  } else if (name === 'marble') {
    ctx.fillStyle = '#f4f1ec';
    ctx.fillRect(0, 0, w, h);
    for (var v = 0; v < 7; v++) {
      ctx.strokeStyle = rand() > 0.4 ? 'rgba(90,90,90,0.45)' : 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1 + rand() * 3;
      ctx.beginPath();
      ctx.moveTo(rand() * w, 0);
      ctx.bezierCurveTo(rand() * w, h * 0.3, rand() * w, h * 0.6, rand() * w, h);
      ctx.stroke();
    }
  } else if (name === 'flame') {
    ctx.fillStyle = '#e8a04a';
    ctx.fillRect(0, 0, w, h);
    for (var f = 0; f < 16; f++) {
      ctx.strokeStyle = f % 2 ? 'rgba(90,30,10,0.75)' : 'rgba(255,220,140,0.55)';
      ctx.lineWidth = 2 + rand() * 3;
      ctx.beginPath();
      var fx = (f / 16) * w;
      ctx.moveTo(fx, 0);
      for (var fy = 0; fy <= h; fy += 16) {
        ctx.lineTo(fx + Math.sin(fy * 0.08 + f) * 10, fy);
      }
      ctx.stroke();
    }
  } else if (name === 'viper') {
    ctx.fillStyle = '#1c2414';
    ctx.fillRect(0, 0, w, h);
    var scale = 18;
    for (var row = 0; row < h / scale + 1; row++) {
      for (var col = 0; col < w / scale + 1; col++) {
        var sx = col * scale + (row % 2 ? scale / 2 : 0);
        var sy = row * scale;
        ctx.fillStyle = (col + row) % 2 ? '#6d8a38' : '#dfe6b4';
        ctx.beginPath();
        ctx.ellipse(sx, sy, scale * 0.42, scale * 0.28, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.stroke();
      }
    }
  } else if (name === 'galaxy') {
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#140828');
    sky.addColorStop(0.5, '#3a1470');
    sky.addColorStop(1, '#08101e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    for (var s = 0; s < 220; s++) {
      var mag = rand();
      ctx.fillStyle = mag > 0.92 ? '#ffd0f0' : (mag > 0.8 ? '#9ad8ff' : '#ffffff');
      ctx.globalAlpha = 0.4 + rand() * 0.6;
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * h, mag > 0.9 ? 1.8 : 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (name === 'pearl') {
    for (var py = 0; py < h; py++) {
      var t = py / h;
      var r = Math.floor(230 + Math.sin(t * 18) * 25);
      var g = Math.floor(210 + Math.sin(t * 18 + 2) * 35);
      var bch = Math.floor(220 + Math.sin(t * 18 + 4) * 30);
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + bch + ')';
      ctx.fillRect(0, py, w, 1);
    }
    gloss();
  } else if (name === 'tiger') {
    ctx.fillStyle = '#e8941c';
    ctx.fillRect(0, 0, w, h);
    for (var st = 0; st < 14; st++) {
      ctx.fillStyle = '#1a120c';
      ctx.beginPath();
      var sy = (st / 14) * h;
      ctx.moveTo(0, sy);
      ctx.quadraticCurveTo(w * 0.5, sy + 18 * (rand() - 0.3), w, sy + 8 * (rand() - 0.5));
      ctx.lineTo(w, sy + 10 + rand() * 14);
      ctx.quadraticCurveTo(w * 0.4, sy + 20, 0, sy + 12);
      ctx.fill();
    }
  } else if (name === 'check') {
    var cell = 16;
    for (var cy = 0; cy < h; cy += cell) {
      for (var cx = 0; cx < w; cx += cell) {
        ctx.fillStyle = ((cx / cell + cy / cell) % 2) ? '#f4f4f4' : '#161616';
        ctx.fillRect(cx, cy, cell, cell);
      }
    }
  } else {
    ctx.fillStyle = '#888';
    ctx.fillRect(0, 0, w, h);
  }
};

WhiteBall.seeded = function (seed) {
  var s = seed % 2147483646;
  if (s < 1) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

WhiteBall.cueMap = function (name, repeatY) {
  var base = WhiteBall.cueTexture(name);
  var tex = new THREE.Texture(base.image);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, repeatY || 1);
  tex.needsUpdate = true;
  if (typeof renderer !== 'undefined' && renderer.getMaxAnisotropy) {
    tex.anisotropy = Math.min(8, renderer.getMaxAnisotropy());
  }
  return tex;
};

WhiteBall.ensureWood = function () {
  if (WhiteBall.woodImage) return;
  var img = new Image();
  WhiteBall.woodImage = img;
  img.onload = function () {
    WhiteBall._textures = {};
    if (typeof game !== 'undefined' && game && game.balls && game.balls[0] && game.balls[0].cueId) {
      game.balls[0].applyCue(game.balls[0].cueId, false);
    }
  };
  img.src = 'images/table/wood.jpg?v=fade';
};

WhiteBall.prototype.applyCue = function (id, save) {
  WhiteBall.ensureWood();
  var style = WhiteBall.cueById(id);
  this.cueId = style.id;
  var keys = ['tip', 'ferrule', 'shaft', 'ring', 'wrap', 'butt', 'bumper'];
  var lengths = [4, 6.3, 80, 4, 23, 26, 3.4];
  for (var i = 0; i < keys.length; i++) {
    var mesh = this.cue.children[i];
    if (!mesh || !mesh.material) continue;
    var material = mesh.material;
    material.color.setHex(style[keys[i]]);
    var shine = style.shine && style.shine[keys[i]];
    material.shininess = shine || (keys[i] === 'ring' ? 90 : 28);
    material.specular.setHex(shine > 80 ? 0x9a9a9a : 0x333333);
    var mapName = style.maps && style.maps[keys[i]];
    if (mapName) {
      var repeat = WhiteBall.MAP_REPEAT[mapName] || 1;
      if (lengths[i] > 40) repeat = Math.max(repeat, 2);
      material.map = WhiteBall.cueMap(mapName, repeat);
      material.bumpMap = material.map;
      material.bumpScale = shine > 80 ? 0.04 : 0.18;
    } else {
      material.map = null;
      material.bumpMap = null;
    }
    material.needsUpdate = true;
  }
  if (style.line) this.setGuideColor(style.line);
  if (save === false) return;
  try { localStorage.setItem('billiards-cue', style.id); } catch (err) {}
};

WhiteBall.prototype.setCueOpacity = function (opacity) {
  this.cueOpacity = opacity;
  for (var i = 0; i < this.cue.children.length; i++) {
    var material = this.cue.children[i].material;
    if (!material) continue;
    var transparent = opacity < 0.999;
    if (material.transparent !== transparent) material.needsUpdate = true;
    material.transparent = transparent;
    material.opacity = opacity;
  }
};

/** Lift the home cue toward the camera, or settle it back on the table. */
WhiteBall.prototype.presentCue = function (lift) {
  this.cueLiftFrom = this.cueLift || 0;
  this.cueLiftTo = lift ? 1 : 0;
  this.cueLiftStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  this.cueLifting = true;
};

WhiteBall.prototype.tickCueFade = function () {
  if (!this.cueLifting) return;
  var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  var t = (now - this.cueLiftStart) / 700;
  if (t > 1) t = 1;
  var eased = t * t * (3 - 2 * t);
  this.cueLift = this.cueLiftFrom + (this.cueLiftTo - this.cueLiftFrom) * eased;
  if (t >= 1) {
    this.cueLift = this.cueLiftTo;
    this.cueLifting = false;
  }
};

WhiteBall.prototype.createIntersectionDot = function () {
  var geometry = new THREE.SphereGeometry(1, 4, 4);
  var material = new THREE.MeshBasicMaterial({opacity: 0.5, transparent: true, color: 0xffff00});
  var sphere = new THREE.Mesh(geometry, material);

  return sphere;
};
WhiteBall.prototype.updateIntersectionDot = function () {
  this.dot.position.copy(this.intersectionPoint);
};

WhiteBall.prototype.setAimToward = function (point) {
  var dx = point.x - this.mesh.position.x;
  var dz = point.z - this.mesh.position.z;
  if (dx * dx + dz * dz < 0.01) return;
  // Local +X of the guide line maps to (cos(angle), 0, -sin(angle))
  this.aimAngle = Math.atan2(-dz, dx);
};

WhiteBall.prototype.updateGuideLine = function () {
  var angle = this.aimAngle;
  this.forward.set(Math.cos(angle), 0, -Math.sin(angle));
  this.forward.normalize();

  this.forwardLine.position.copy(this.mesh.position);
  this.forwardLine.position.x += this.forward.x * Ball.RADIUS;
  this.forwardLine.position.z += this.forward.z * Ball.RADIUS;
  this.forwardLine.rotation.y = angle;

  var hit = this.firstBallOnAim();

  if (!hit) {
    this.objectLine.visible = false;
    this.objectCap.visible = false;
    this.intersectionPoint = this.forwardLine.ray.intersectBox(this.forwardLine.box, this.lineEnd);
  } else {
    // Draw the cue line up to the ball it touches. Thin cuts only meet the
    // collision sphere, so the line stops where the cue center will be.
    this.hitSphere.radius = Ball.RADIUS;
    this.hitSphere.center.copy(hit.ball.mesh.position);
    var touch = this.forwardLine.ray.intersectSphere(this.hitSphere, this.ghostPoint);
    this.hitSphere.radius = Ball.RADIUS * 2;
    this.intersectionPoint = touch ? this.lineEnd.copy(touch) : this.lineEnd.copy(hit.ghost);
    this.updateObjectLine(hit.ball, hit.ghost);
  }

  var distance = this.intersectionPoint
    ? this.mesh.position.distanceTo(this.intersectionPoint)
    : 80;
  distance = Math.max(distance - Ball.RADIUS, 0.5);

  this.forwardLine.scale.x = distance;
  this.forwardCap.position.copy(this.forwardLine.position);
  this.forwardCap.position.x += this.forward.x * distance;
  this.forwardCap.position.z += this.forward.z * distance;
  this.forwardCap.position.y = this.mesh.position.y;
  this.forwardCap.visible = true;
  this.setGuideDim(hit && this.aimIsBlocked(hit.ball));
};

WhiteBall.prototype.aimIsBlocked = function (ball) {
  if (typeof eightballgame === 'undefined' || !eightballgame || !ball) return false;
  var num = parseInt(ball.name, 10);
  if (!num) return false;
  var side = eightballgame.sides[eightballgame.turn];
  if (num === 8) return !this.eightBallIsLegal(side);
  if (side !== 'solid' && side !== 'striped') return false;
  return side === 'solid' ? num > 8 : num < 8;
};

WhiteBall.prototype.eightBallIsLegal = function (side) {
  if (side !== 'solid' && side !== 'striped') return false;
  var balls = eightballgame.numbered_balls_on_table;
  for (var i = 0; i < balls.length; i++) {
    var n = balls[i];
    if (n === 8) continue;
    if (side === 'solid' && n < 8) return false;
    if (side === 'striped' && n > 8) return false;
  }
  return true;
};

WhiteBall.prototype.setGuideDim = function (dim) {
  var opacity = dim ? 0.28 : 1;
  this.setGroupOpacity(this.forwardLine, opacity);
  this.setGroupOpacity(this.forwardCap, opacity);
  this.setGroupOpacity(this.objectLine, opacity);
  this.setGroupOpacity(this.objectCap, opacity);
  this.aimBlocked = !!dim;
  var btn = document.getElementById('btn_ball');
  if (!btn) return;
  btn.disabled = this.aimBlocked;
  if (this.aimBlocked) GameGui.addClass(btn, 'is-blocked');
  else GameGui.removeClass(btn, 'is-blocked');
};

WhiteBall.prototype.setGroupOpacity = function (group, opacity) {
  if (!group) return;
  for (var i = 0; i < group.children.length; i++) {
    var material = group.children[i].material;
    if (!material) continue;
    material.opacity = opacity;
  }
};

/** Closest ball the cue ball would actually touch, using a sphere of radius 2R. */
WhiteBall.prototype.firstBallOnAim = function () {
  var closestBall = null;
  var closestDist = Infinity;

  for (var i = 1; i < game.balls.length; i++) {
    var curBall = game.balls[i];
    if (curBall.fallen) continue;

    this.hitSphere.center.copy(curBall.mesh.position);
    var ghost = this.forwardLine.ray.intersectSphere(this.hitSphere, this.ghostPoint);
    if (!ghost) continue;

    var dist = this.mesh.position.distanceTo(ghost);
    if (dist < closestDist) {
      closestDist = dist;
      closestBall = curBall;
      this.savedGhost.copy(ghost);
    }
  }

  if (!closestBall) return null;
  return { ball: closestBall, ghost: this.savedGhost };
};

/**
 * Object ball leaves along the line of centers at impact.
 * Ghost is where the cue ball center will be when the balls touch.
 */
WhiteBall.prototype.updateObjectLine = function (ball, ghost) {
  this.objectDir.subVectors(ball.mesh.position, ghost);
  this.objectDir.y = 0;

  if (this.objectDir.lengthSq() < 0.0001) {
    this.objectLine.visible = false;
    this.objectCap.visible = false;
    return;
  }

  this.objectDir.normalize();
  var angle = Math.atan2(-this.objectDir.z, this.objectDir.x);

  this.objectLine.visible = true;
  this.objectLine.position.copy(ball.mesh.position);
  this.objectLine.position.x += this.objectDir.x * Ball.RADIUS;
  this.objectLine.position.y = ball.mesh.position.y;
  this.objectLine.position.z += this.objectDir.z * Ball.RADIUS;
  this.objectLine.rotation.y = angle;

  this.objectRay.origin.copy(ball.mesh.position);
  this.objectRay.direction.copy(this.objectDir);
  var cushion = this.objectRay.intersectBox(this.forwardLine.box, this.cushionPoint);
  var length = cushion
    ? ball.mesh.position.distanceTo(cushion) - Ball.RADIUS
    : 40;
  if (length < 2) length = 2;

  this.objectLine.scale.x = length;
  this.objectCap.position.copy(this.objectLine.position);
  this.objectCap.position.x += this.objectDir.x * length;
  this.objectCap.position.z += this.objectDir.z * length;
  this.objectCap.visible = true;
};

WhiteBall.prototype.makeRibbon = function (color, width, lift) {
  var geometry = new THREE.PlaneGeometry(1, width);
  geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0.5, lift, 0));
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: THREE.DoubleSide
  }));
};

WhiteBall.prototype.setGuideColor = function (color) {
  this.paintGuide(this.objectLine, color);
  this.paintGuide(this.objectCap, color);
};

WhiteBall.prototype.paintGuide = function (group, color) {
  if (!group || !group.children[1] || !group.children[1].material) return;
  group.children[1].material.color.setHex(color);
};

WhiteBall.prototype.createGuideLine = function (color, width) {
  var line = new THREE.Object3D();
  var outline = this.makeRibbon(0x141414, width, 0.03);
  var core = this.makeRibbon(color, width * 0.58, 0.08);
  outline.renderOrder = 2;
  core.renderOrder = 3;
  line.add(outline);
  line.add(core);
  line.position.set(100, 100, 100);
  line.box = new THREE.Box3(
    new THREE.Vector3(-Table.LEN_X / 2, 0,               -Table.LEN_Z / 2),
    new THREE.Vector3( Table.LEN_X / 2, 2 * Ball.RADIUS,  Table.LEN_Z / 2)
  );
  line.ray = new THREE.Ray(this.mesh.position, this.forward);
  line.visible = false;
  return line;
};

WhiteBall.prototype.makeDisc = function (color, radius, lift) {
  var geometry = new THREE.CircleGeometry(radius, 28);
  geometry.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, lift, 0));
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: THREE.DoubleSide
  }));
};

WhiteBall.prototype.createCap = function (color, radius) {
  var cap = new THREE.Object3D();
  var outline = this.makeDisc(0x141414, radius, 0.03);
  var core = this.makeDisc(color, radius * 0.58, 0.08);
  outline.renderOrder = 2;
  core.renderOrder = 3;
  cap.add(outline);
  cap.add(core);
  cap.visible = false;
  return cap;
};
