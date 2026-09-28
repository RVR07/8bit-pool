var WIDTH  = 960,
    HEIGHT = 480;

// Globals
var renderer, scene, camera, game, controls, keyboard, lightsConfig, world, gui, eightballgame;
var debug = false; // if true then collision wireframes are drawn

var progressBar;

var stats = new Stats();
stats.setMode( 0 ); // 0: fps, 1: ms, 2: mb

var textureLoader = new THREE.TextureLoader();
THREE.DefaultLoadingManager.onProgress = function (item, loaded, total) {
  if (typeof progressBar !== 'undefined') {
    progressBar.style.width = (loaded / total * 100) + '%';
  }

  if (loaded == total && total > 7) {
    // hide progress bar
    var progBarDiv = document.getElementById('loading');
    progBarDiv.parentNode.removeChild(progBarDiv);

    gui.show(document.getElementById('mainMenu'));
    if (game && game.showMenuPose) game.showMenuPose();

    // attach the render-supplied DOM element
    var canvasContainer = document.getElementById('canvas');
    canvasContainer.appendChild(renderer.domElement);
    draw();
  }
};

// Set some camera attributes
var VIEW_ANGLE = 45,
    ASPECT     = WIDTH / HEIGHT,
    NEAR       = 1,
    FAR        = 1000;

// We use the clock to measure time, an extension for the keyboard
var clock = new THREE.Clock();

function onLoad() {
  gui = new GameGui();

  progressBar = document.getElementById('prog-bar');

  // create a WebGL renderer, camera
  // and a scene
  camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
  camera.up = new THREE.Vector3(0,1,0);

  scene = new THREE.Scene();
  scene.add(camera);

  // create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  resizeGame();
  window.addEventListener('resize', resizeGame);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Setup our cannon.js world for physics
  world = createPhysicsWorld();
  // Populate meshes and physics bodies:
  game = new Game();
  // Define how different objects interect physics-wise:
  setCollisionBehaviour();
  // Configure lighting:
  addLights();

  // Camera stays locked overhead. Dragging aims the cue ball instead.
  controls = new THREE.OrbitControls(camera,renderer.domElement);
  controls.enabled = false;

  controls.target.set(0, 0, 0);
  camera.position.set(0, CAMERA_HEIGHT, 0.5);
  camera.lookAt(controls.target);

  setupAimDrag();

  // make the background void a grey color instead of black.
  renderer.setClearColor(0x101114, 1);
}

function resizeGame() {
  var width = window.innerWidth;
  var height = window.innerHeight;
  if (height < 1) height = 1;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);

  var tan = Math.tan((VIEW_ANGLE * Math.PI / 180) / 2);
  var halfX = Table.LEN_X / 2 + 36;
  var halfZ = Table.LEN_Z / 2 + 36;
  var distForWidth = halfX / (tan * camera.aspect);
  var distForHeight = halfZ / tan;
  CAMERA_HEIGHT = Math.max(distForWidth, distForHeight) * 1.08;
  if (typeof WhiteBall !== 'undefined' && WhiteBall.resizeOverlay) WhiteBall.resizeOverlay();
}

function createPhysicsWorld () {
  w = new CANNON.World();
  w.gravity.set(0, 30 * -9.82, 0); // m/s²

  w.solver.iterations = 10;
  w.solver.tolerance = 0; // Force solver to use all iterations

  // Allow sleeping
  w.allowSleep = true;

  w.fixedTimeStep = 1.0 / 60.0; // seconds

  return w;
}

/** Here the interaction when two materials touch is defined. E.g. how much a ball
    loses energy when hitting a wall.
    !TODO figure out whether the definition of Contactmaterials should be defined in
    some other place. For example, perhaps each ball object should define it's contactmaterial
    with the walls itself?
*/
function setCollisionBehaviour() {
  world.defaultContactMaterial.friction = 0.1;
  world.defaultContactMaterial.restitution = 0.85;

  var ball_floor = new CANNON.ContactMaterial(
    Ball.contactMaterial,
    Table.floorContactMaterial,
    {friction: 0.7, restitution: 0.1}
  );

  var ball_wall = new CANNON.ContactMaterial(
    Ball.contactMaterial,
    Table.wallContactMaterial,
    {friction: 0.5, restitution: 0.9}
  );

  world.addContactMaterial(ball_floor);
  world.addContactMaterial(ball_wall);
}

var CAMERA_HEIGHT = 250;

var aimRaycaster = new THREE.Raycaster();
var aimMouse = new THREE.Vector2();
var aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
var aimPoint = new THREE.Vector3();

function setupAimDrag() {
  var canvas = renderer.domElement;
  canvas.style.touchAction = 'none';
  var powerDrag = null;
  var powerStart = new THREE.Vector3();
  var powerNow = new THREE.Vector3();

  function canCharge() {
    if (!game || !game.balls[0] || game.balls[0].showcase || game.balls[0].cueAnimating) return false;
    if (typeof eightballgame === 'undefined' || !eightballgame || eightballgame.state !== 'turn') return false;
    if (game.balls[0].rigidBody.sleepState !== CANNON.Body.SLEEPING) return false;
    if (typeof gui !== 'undefined' && gui.live && gui.live.on && !gui.live.myTurn()) return false;
    if (game.balls[0].aimBlocked) return false;
    return true;
  }

  function pullStrength(event) {
    if (!tablePointFromEvent(event, powerNow)) return;
    var ball = game.balls[0];
    if (ball.updateGuideLine) ball.updateGuideLine();
    var backX = -ball.forward.x;
    var backZ = -ball.forward.z;
    var along = (powerNow.x - powerStart.x) * backX + (powerNow.z - powerStart.z) * backZ;
    if (along < 0) along = 0;
    var t = along / 46;
    if (t > 1) t = 1;
    if (along > 4) powerDrag.pulled = true;
    if (gui && gui.setStrength) gui.setStrength(10 + t * 90);
  }

  canvas.addEventListener('pointerdown', function (event) {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    if (!canCharge()) {
      if (!game || !game.balls[0] || game.balls[0].showcase) return;
      var ball = game.balls[0];
      if (ball.aimLocked) {
        ball.aimLocked = false;
        aimFromPointer(event);
      } else {
        aimFromPointer(event);
        ball.aimLocked = true;
      }
      return;
    }
    if (!tablePointFromEvent(event, powerStart)) return;
    powerDrag = { pulled: false };
    try { canvas.setPointerCapture(event.pointerId); } catch (err) {}
  });

  canvas.addEventListener('pointermove', function (event) {
    if (powerDrag) {
      pullStrength(event);
      return;
    }
    aimFromPointer(event);
  });

  function releaseShot(event) {
    if (!powerDrag) return;
    var pulled = powerDrag.pulled;
    powerDrag = null;
    if (!pulled) {
      if (!game || !game.balls[0] || game.balls[0].showcase) return;
      var ball = game.balls[0];
      if (ball.aimLocked) {
        ball.aimLocked = false;
        aimFromPointer(event);
      } else {
        aimFromPointer(event);
        ball.aimLocked = true;
      }
      return;
    }
    if (!canCharge() || typeof eightballgame === 'undefined' || !eightballgame) return;
    if (typeof Sound !== 'undefined') Sound.ensure();
    var strength = game.balls[0].cueStrength;
    eightballgame.hitButtonClicked(strength);
  }

  window.addEventListener('pointerup', releaseShot);
  window.addEventListener('pointercancel', function () { powerDrag = null; });
}

function tablePointFromEvent(event, out) {
  var rect = renderer.domElement.getBoundingClientRect();
  var point = event;
  if (event.touches && event.touches[0]) point = event.touches[0];
  aimMouse.x = ((point.clientX - rect.left) / rect.width) * 2 - 1;
  aimMouse.y = -((point.clientY - rect.top) / rect.height) * 2 + 1;
  camera.updateMatrixWorld();
  aimRaycaster.setFromCamera(aimMouse, camera);
  return aimRaycaster.ray.intersectPlane(aimPlane, out);
}

function aimFromPointer(event) {
  if (!tablePointFromEvent(event, aimPoint)) return;
  if (!game || !game.balls[0]) return;
  if (typeof gui !== 'undefined' && gui.live && gui.live.on && typeof eightballgame !== 'undefined' && eightballgame && gui.live.seat !== eightballgame.turn) return;
  if (game.balls[0].showcase || game.balls[0].aimLocked) return;

  game.balls[0].setAimToward(aimPoint);
  if (typeof Live !== 'undefined' && gui.live && gui.live.on && gui.live.myTurn()) {
    Live.noteAim(game.balls[0].aimAngle, game.balls[0].cueStrength);
  }
}

function draw() {
  stats.begin();

  // Keep the overhead camera fixed on the table
  camera.position.set(0, CAMERA_HEIGHT, 0.5);
  camera.lookAt(controls.target);

  // Physics world
  var watching = typeof gui !== 'undefined' && gui.live && gui.live.on && !gui.live.host;
  if (!watching || (typeof Live !== 'undefined' && Live.predicting)) world.step(w.fixedTimeStep);

  // THREE objects
  var dt = clock.getDelta();
  game.tick(dt);
  if (typeof Live !== 'undefined' && Live.on) Live.frame();

  stats.end();
  requestAnimationFrame(draw);
  renderer.render(scene, camera); // We render our scene with our camera
  if (typeof WhiteBall !== 'undefined' && WhiteBall._overlay && WhiteBall._overlay.active) {
    WhiteBall._overlay.renderer.render(WhiteBall._overlay.scene, WhiteBall._overlay.camera);
  }
}

// Adds an ambient light and two spotlights above the table
function addLights() {
  scene.add(new THREE.AmbientLight(0x3a3a3a));
  scene.add(new THREE.HemisphereLight(0xdfe3ea, 0x1a1c20, 0.35));
  var tableLight1 = new TableLight( Table.LEN_X / 4, 150, 0);
  var tableLight2 = new TableLight(-Table.LEN_X / 4, 150, 0);
}
