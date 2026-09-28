var Table = function () {
  var mesh_x = -Table.LEN_X / 2;
  var mesh_y = 0;
  var mesh_z = Table.LEN_Z / 2;

  var loader = new THREE.JSONLoader();
  loader.load('json/table/base.json', function (geometry) {
    var mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
      color: new THREE.Color(0x000000),
      specular: 0x404040,
      shininess: 20,
      shading: THREE.SmoothShading
    }));

    mesh.position.x = mesh_x;
    mesh.position.y = mesh_y;
    mesh.position.z = mesh_z;
    mesh.scale.set(100, 100, 100);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
  });

  loader.load('json/table/felt.json', function (geometry) {
    Table.assignClothUVs(geometry, 1.35);
    var feltMap = Table.repeatTexture('images/table/felt.jpg?v=fade2');
    var feltBump = Table.repeatTexture('images/table/felt-bump.jpg?v=fade2');
    var mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
      color: 0x3c424a,
      map: feltMap,
      bumpMap: feltBump,
      bumpScale: 0.12,
      specular: 0x1c1c1c,
      shininess: 6,
      shading: THREE.SmoothShading
    }));
    Table.feltMesh = mesh;
    Table.applyCity();

    mesh.position.x = mesh_x;
    mesh.position.y = mesh_y;
    mesh.position.z = mesh_z;
    mesh.scale.set(100, 100, 100);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
  });

  loader.load('json/table/edges.json', function (geometry) {
    Table.assignWoodUVs(geometry, 0.85);
    var woodMap = Table.repeatTexture('images/table/wood.jpg?v=fade');
    var woodBump = Table.repeatTexture('images/table/wood-bump.jpg?v=fade');
    var mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
      color: 0x16181c,
      map: woodMap,
      bumpMap: woodBump,
      bumpScale: 0.4,
      specular: 0x2a2a2a,
      shininess: 18,
      shading: THREE.SmoothShading
    }));
    Table.edgeMesh = mesh;
    Table.applyCity();

    mesh.position.x = mesh_x;
    mesh.position.y = mesh_y;
    mesh.position.z = mesh_z;
    mesh.scale.set(100, 100, 100);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
  });

  loader.load('json/table/pockets.json', function (geometry) {
    var mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
      color: 0x101216,
      specular: 0x1a1a1a,
      shininess: 12,
      shading: THREE.SmoothShading
    }));

    mesh.position.x = mesh_x;
    mesh.position.y = mesh_y;
    mesh.position.z = mesh_z;
    mesh.scale.set(100, 100, 100);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
  });

  loader.load('json/table/pocket_bottoms.json', function (geometry) {
    var mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
      color: new THREE.Color(0x000),
      specular: 0x000,
      shininess: 0,
      shading: THREE.SmoothShading
    }));

    mesh.position.x = mesh_x;
    mesh.position.y = mesh_y;
    mesh.position.z = mesh_z;
    mesh.scale.set(100, 100, 100);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
  });

  this.rigidBody = this.createFloor(); //floor

  //corners of -x table side
  this.hole1 = new Hole( Table.LEN_X / 2 + 1.5, 0, -Table.LEN_Z / 2 - 1.5,  Math.PI / 4);
  this.hole2 = new Hole(-Table.LEN_X / 2 - 1.5, 0, -Table.LEN_Z / 2 - 1.5, -Math.PI / 4);
  //middle holes
  this.hole3 = new Hole(0, 0, -Table.LEN_Z / 2 - 4.8, 0);
  this.hole4 = new Hole(0, 0,  Table.LEN_Z / 2 + 4.8, Math.PI);
  //corners of +x table side
  this.hole5 = new Hole( Table.LEN_X / 2 + 1.5, 0, Table.LEN_Z / 2 + 1.5,  3 * Math.PI / 4);
  this.hole6 = new Hole(-Table.LEN_X / 2 - 1.5, 0, Table.LEN_Z / 2 + 1.5, -3 * Math.PI / 4);

  this.walls = this.createWallBodies();
};

Table.CITY_CLOTH = {
  lisbon: { felt: 0x8a6244, rail: 0x2a2018 },
  cairo:  { felt: 0xa07848, rail: 0x2c2216 },
  venice: { felt: 0x3f6e78, rail: 0x141c20 },
  paris:  { felt: 0x7a5564, rail: 0x24181c },
  london: { felt: 0x6a4a50, rail: 0x201618 },
  tokyo:  { felt: 0x4e4a78, rail: 0x16141e },
  monaco: { felt: 0x3a5568, rail: 0x14181e }
};

Table.HOME_CLOTH = { felt: 0x3c424a, rail: 0x16181c };

Table.setCity = function (id) {
  Table.city = id;
  Table.applyCity();
};

Table.applyCity = function () {
  var cloth = Table.CITY_CLOTH[Table.city] || Table.HOME_CLOTH;
  if (Table.feltMesh) Table.feltMesh.material.color.setHex(cloth.felt);
  if (Table.edgeMesh) Table.edgeMesh.material.color.setHex(cloth.rail);
};

Table.repeatTexture = function (url) {
  var texture = THREE.ImageUtils.loadTexture(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = renderer && renderer.getMaxAnisotropy ? Math.min(8, renderer.getMaxAnisotropy()) : 4;
  return texture;
};

Table.assignClothUVs = function (geometry, scale) {
  Table.assignUVs(geometry, function (v) {
    return new THREE.Vector2(v.x * scale, v.z * scale);
  });
};

Table.assignWoodUVs = function (geometry, scale) {
  geometry.computeFaceNormals();
  var side = scale * 14;
  Table.assignUVs(geometry, function (v, face) {
    var n = face.normal;
    var ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    if (ay >= ax && ay >= az) return new THREE.Vector2(v.x * scale, v.z * scale);
    if (ax >= az) return new THREE.Vector2(v.z * scale, v.y * side);
    return new THREE.Vector2(v.x * scale, v.y * side);
  });
};

Table.assignUVs = function (geometry, project) {
  var uvs = [];
  for (var i = 0; i < geometry.faces.length; i++) {
    var face = geometry.faces[i];
    var ids = [face.a, face.b, face.c];
    if (face.d !== undefined) ids.push(face.d);
    var faceUvs = [];
    for (var k = 0; k < ids.length; k++) {
      faceUvs.push(project(geometry.vertices[ids[k]], face));
    }
    uvs.push(faceUvs);
  }
  geometry.faceVertexUvs[0] = uvs;
  geometry.uvsNeedUpdate = true;
};

Table.LEN_Z = 137.16;
Table.LEN_X = 274.32;
Table.WALL_HEIGHT = 6;
Table.floorContactMaterial = new CANNON.Material('floorMaterial');
Table.wallContactMaterial = new CANNON.Material('wallMaterial');

/** Creates cannon js walls
This method is 3am spaghetti, you've been warned..*/
Table.prototype.createWallBodies = function () {
  //walls of -z
  var wall1 = new LongWall( Table.LEN_X / 4 - 0.8, 2, -Table.LEN_Z / 2, 61);
  var wall2 = new LongWall(-Table.LEN_X / 4 + 0.8, 2, -Table.LEN_Z / 2, 61);
  wall2.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI);

  //walls of -z
  var wall3 = new LongWall( Table.LEN_X / 4 - 0.8, 2, Table.LEN_Z / 2, 61);
  var wall4 = new LongWall(-Table.LEN_X / 4 + 0.8, 2, Table.LEN_Z / 2, 61);
  wall3.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0),  Math.PI);
  wall4.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI);

  //wall of +x
  var wall5 = new ShortWall(Table.LEN_X / 2, 2, 0, 60.5);

  //wall of -x
  var wall6 = new ShortWall(-Table.LEN_X / 2, 2, 0, 60.5);
  wall6.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -1.5 * Math.PI);

  var walls = [wall1, wall2, wall3, wall4, wall5, wall6];
  for (var i in walls) {
    world.addBody(walls[i].body);
    if (debug) {
      addCannonVisual(walls[i].body);
    }
  }

  return walls;
};

Table.prototype.createFloor = function () {
  var narrowStripWidth = 2;
  var narrowStripLength = Table.LEN_Z / 2 - 5;
  var floorThickness = 1;
  var mainAreaX = Table.LEN_X / 2 - 2 * narrowStripWidth;

  var floorBox = new CANNON.Box(new CANNON.Vec3(mainAreaX, floorThickness, Table.LEN_Z / 2));
  var floorBoxSmall = new CANNON.Box(new CANNON.Vec3(narrowStripWidth, floorThickness, narrowStripLength));

  this.body = new CANNON.Body({
    mass: 0, // mass == 0 makes the body static
    material: Table.floorContactMaterial
  });
  this.body.addShape(floorBox,      new CANNON.Vec3(0, -floorThickness, 0));
  this.body.addShape(floorBoxSmall, new CANNON.Vec3(-mainAreaX - narrowStripWidth, -floorThickness, 0));
  this.body.addShape(floorBoxSmall, new CANNON.Vec3( mainAreaX + narrowStripWidth, -floorThickness, 0));

  if (debug) {
    addCannonVisual(this.body, 0xff0000);
  }
  world.add(this.body);
};
