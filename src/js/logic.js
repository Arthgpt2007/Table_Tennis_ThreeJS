//ALL THE IMPORTS

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import tableModelUrl from 'url:../models/table_tennis_table.glb';
import racketModelUrl from 'url:../models/joola_rosskopf_table_tennis_racket_free.glb';
import floorTextureUrl from 'url:../textures/wood.jpg';
import concreteTextureUrl from 'url:../textures/concrete.jpg';
import RAPIER from '@dimforge/rapier3d-compat';

//ASYNC FUNCTION TO LOAD EVERYTHING

(async function () {


  //Initialize Rapier
  await RAPIER.init();
  const gravity = { x: 0, y: -9.81, z: 0 };
  const world = new RAPIER.World(gravity);

  //Event
  const eventQueue = new RAPIER.EventQueue(true);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Scene 
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101010);

  // Camera
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 3.5, 5);
  camera.lookAt(0, 0.5, 0);

  // Lighting

  //Ambient Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  //Hemispherical Lighting
  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  hemisphereLight.position.set(0, 50, 0);
  scene.add(hemisphereLight);

  //Directional Lighting
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
  directionalLight.position.set(5, 10, 7.5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 1;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -15;
  directionalLight.shadow.camera.right = 15;
  directionalLight.shadow.camera.top = 15;
  directionalLight.shadow.camera.bottom = -15;
  scene.add(directionalLight);


  //  Lighting End


  // Floor


  const courtTexture = new THREE.TextureLoader().load(floorTextureUrl);
  courtTexture.wrapS = THREE.RepeatWrapping;
  courtTexture.wrapT = THREE.RepeatWrapping;
  courtTexture.repeat.set(6, 10);

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: courtTexture,
    roughness: 0.6,
    metalness: 0.1,
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 40), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  //Court Lines 
  const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lineThickness = 0.05;

  function makeLine(width, depth, x, z) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(width, 0.01, depth), lineMaterial);
    line.position.set(x, 0.01, z);
    scene.add(line);
  }

  makeLine(30, lineThickness, 0, 20);
  makeLine(30, lineThickness, 0, -20);
  makeLine(lineThickness, 40, 15, 0);
  makeLine(lineThickness, 40, -15, 0);

  // FLOOR END

  //Walls (All Four Sides with Texture)


  const wallTexture = new THREE.TextureLoader().load(concreteTextureUrl);
  wallTexture.wrapS = THREE.RepeatWrapping;
  wallTexture.wrapT = THREE.RepeatWrapping;
  wallTexture.repeat.set(3, 2);

  const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallTexture,
    roughness: 0.8,
    metalness: 0.1,
  });

  const wallThickness = 0.5;
  const wallHeight = 10;
  const wallWidth = 30;
  const wallDepth = 40;

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(wallWidth, wallHeight, wallThickness), wallMaterial);
  backWall.position.set(0, wallHeight / 2, -wallDepth / 2 - wallThickness / 2);
  scene.add(backWall);

  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(wallWidth, wallHeight, wallThickness), wallMaterial);
  frontWall.position.set(0, wallHeight / 2, wallDepth / 2 + wallThickness / 2);
  scene.add(frontWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, wallDepth), wallMaterial);
  leftWall.position.set(-wallWidth / 2 - wallThickness / 2, wallHeight / 2, 0);
  scene.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, wallDepth), wallMaterial);
  rightWall.position.set(wallWidth / 2 + wallThickness / 2, wallHeight / 2, 0);
  scene.add(rightWall);

  //  WALLS END

  //Load Table and Create Physics Collider 

  const loader = new GLTFLoader();
  let tableBody, tableCollider, tableWidth, tableDepth, tableTopY;

  loader.load(
    tableModelUrl,
    (gltf) => {
      const model = gltf.scene;
      model.position.set(0, 0, 0);
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      scene.add(model);

      // Compute top height of the table model
      const bbox = new THREE.Box3().setFromObject(model);
      tableTopY = bbox.max.y; // highest Y value = table surface
      tableWidth = bbox.max.x - bbox.min.x;
      tableDepth = bbox.max.z - bbox.min.z;
      console.log("Table surface Y height:", tableTopY);

      // Create physics collider using actual height
      tableBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      tableCollider = RAPIER.ColliderDesc.cuboid(
        (bbox.max.x - bbox.min.x) / 2,
        0.1,// thin surface
        (bbox.max.z - bbox.min.z) / 2
      )
        .setTranslation(0, tableTopY - 0.32, 0)
        .setRestitution(0.4)
        .setFriction(0.01)


      world.createCollider(tableCollider, tableBody);

    },
    undefined,
    (error) => console.error('Table load error:', error)
  );

  // TABLE AND COLLDIER LOADER END

  // Opposite Side Wall
  const opponentWallGroup = new THREE.Group();


  const twallTexture = new THREE.TextureLoader().load(concreteTextureUrl);
  wallTexture.wrapS = THREE.RepeatWrapping;
  wallTexture.wrapT = THREE.RepeatWrapping;
  wallTexture.repeat.set(2, 1);

  const twallMaterial = new THREE.MeshStandardMaterial({
    map: twallTexture,
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0.2,
  });

  const twallWidth = 2.8;
  const twallHeight = 1.9;
  const twallDepth = 0.1; // visual depth
  const opponentWallMesh = new THREE.Mesh(
    new THREE.BoxGeometry(twallWidth, twallHeight, twallDepth),
    wallMaterial
  );
  opponentWallMesh.castShadow = true;
  opponentWallMesh.receiveShadow = true;


  opponentWallMesh.position.set(0, 2.5, -2.5);
  opponentWallGroup.add(opponentWallMesh);


  const backLight = new THREE.PointLight(0xaaaaaa, 0.3, 10);
  backLight.position.set(0, 3, -3.5);
  scene.add(backLight);

  // Add wall to scene
  scene.add(opponentWallGroup);


  const wallBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

  const wallCollider = RAPIER.ColliderDesc.cuboid(
    1.4,
    2.2,
    0.40
  )
    .setTranslation(0, 2.5, -2.50)
    .setRestitution(0.9)
    .setFriction(0.0);

  const opponentWallCollider = world.createCollider(wallCollider, wallBody);
  let opponentWallColliderRef = opponentWallCollider;

  //OPPONENT WALL END


  // RACKET SETUP AND LOADER //


  let racket, racketBody, racketCollider, racketVisualMesh;

  loader.load(
    racketModelUrl,
    (gltf) => {
      // Load 3D model
      racket = gltf.scene;
      racket.scale.set(0.3, 0.3, 0.3);
      racket.position.set(0, 0.95, 4);
      racket.rotation.y = Math.PI;
      racket.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      scene.add(racket);


      // Create kinematic physics body
      racketBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
      );

      // Create visual mesh for collider
      const colliderWidth = 0.6;
      const colliderHeight = 0.6;
      const colliderDepth = 0.25;

      racketVisualMesh = new THREE.Mesh(
        new THREE.BoxGeometry(colliderWidth, colliderHeight, colliderDepth),
        new THREE.MeshStandardMaterial({
          color: 0x00ff00,
          transparent: true,
          opacity: 0.4,
        })
      );


      // Create collider (attach to body)
      racketCollider = world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          colliderWidth / 2,
          colliderHeight / 2,
          colliderDepth / 2
        )
          .setRestitution(0.5)
          .setFriction(0.01)
          .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min),
        racketBody
      );
    },
    undefined,
    (err) => console.error("Racket load error:", err)
  );


  // RACKET SETUP END


  // Keyboard Movement 

  const movement = { forward: false, backward: false, left: false, right: false };
  const speed = 0.1;

  window.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'ArrowUp') movement.forward = true;
    if (e.key === 's' || e.key === 'ArrowDown') movement.backward = true;
    if (e.key === 'a' || e.key === 'ArrowLeft') movement.left = true;
    if (e.key === 'd' || e.key === 'ArrowRight') movement.right = true;
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'ArrowUp') movement.forward = false;
    if (e.key === 's' || e.key === 'ArrowDown') movement.backward = false;
    if (e.key === 'a' || e.key === 'ArrowLeft') movement.left = false;
    if (e.key === 'd' || e.key === 'ArrowRight') movement.right = false;
  });


  //KEYBOARD MOVEMENT END



  // BALL SETUP (bouncy but less speed on return) 


  const ballRadius = 0.04;
  const ballGeometry = new THREE.SphereGeometry(ballRadius, 32, 32);
  const ballMaterial = new THREE.MeshStandardMaterial({
    color: "#FFFFFF",
    emissive: 0x331100,
    roughness: 0.5,
    metalness: 0.2
  });
  const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
  ballMesh.castShadow = true;
  scene.add(ballMesh);

  // Ball physics body
  const ballBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0, 3, 2.5)
    .setLinearDamping(0.1)
    .setAngularDamping(0.1)


  const ballBody = world.createRigidBody(ballBodyDesc);

  // Ball collider — high bounce, mild friction
  const ballCollider = RAPIER.ColliderDesc.ball(ballRadius)
    .setRestitution(0.9)
    .setFriction(0.01)
    .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
    .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);

  world.createCollider(ballCollider, ballBody);

  // BALL SETUP END

  // Floor collider
  const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const floorCollider = RAPIER.ColliderDesc.cuboid(15, 0.05, 20)
    .setTranslation(0, 0, 0)
    .setRestitution(0.9)
    .setFriction(0.3);
  world.createCollider(floorCollider, floorBody);

  // Resize with respective size of the window
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  //Some Global variables for Racket Hit Detection And Adding Impulse to Ball
  let prevRacketPos = new THREE.Vector3();
  let racketVelocity = new THREE.Vector3();

  // Animate
  const clock = new THREE.Clock();

  //Variables for random direction after wall hit
  let lastWallHitTime = 0;
  const wallZ = -2.5 + 0.4;


  //Pop up message for foul
  function showFoulMessage() {
    const msg = document.getElementById("foul-message");
    if (!msg) return;

    msg.classList.add("show");

    // Hide again after 1 second
    setTimeout(() => {
      msg.classList.remove("show");
    }, 1000);
  }

  //Ball Reset //

  // New clean table bounds
  const TABLE_HALF_WIDTH = 1.525 / 2;
  const TABLE_HALF_LENGTH = 2.74;
  const TABLE_SURFACE_Y = 0.76;
  let isResetting = false;

  function resetBall() {
    if (isResetting) return;   // prevents loops
    isResetting = true;

    const safeY = 2.5;
    const mySideZ = TABLE_HALF_LENGTH - 0.3;

    ballBody.setTranslation(
      { x: 0, y: safeY, z: mySideZ },
      true
    );

    ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);

    showFoulMessage();

    // allow resets again next frame
    setTimeout(() => { isResetting = false; }, 30);
  }



  function checkBallOutOfPlay() {
    if (isResetting) return;

    const pos = ballBody.translation();

    const offLeftRight = Math.abs(pos.x) > (tableWidth / 2);
    const fell = pos.y < tableTopY - 0.05;
    const onMySide = pos.z > 1
    const behindOpponent = pos.z < -(tableDepth / 2 + 0.2);
    const ground = pos.y < 0.1;

    if ((ground && onMySide && fell) || offLeftRight || behindOpponent) {
      resetBall();
    }
  }


  // Keyboard Shortcut for Manual Ball Reset 
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r') {

      // Reset ball’s position slightly above the table
      ballBody.setTranslation({ x: 0, y: 2.5, z: 2.5 }, true);
      ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  });


  //Racket Impulse Function //
  let lastHitTime = 0;

  function applyRacketImpulse() {

    if (!racketBody || !ballBody) return;

    const now = performance.now();
    lastHitTime = performance.now();
    if (now - lastHitTime < 120) return;

    const racketPos = racketBody.translation();
    const ballPos = ballBody.translation();

    const dx = ballPos.x - racketPos.x;
    const dy = ballPos.y - racketPos.y;
    const dz = ballPos.z - racketPos.z;

    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const dirX = dx / length;
    const dirY = dy / length;

    // Forward power always sends the ball to opponent side
    const forwardPower = 0.8;
    const upwardPower = 1.2;
    const sidePower = dirX * 1.2;

    const impulse = {
      x: sidePower,
      y: upwardPower,
      z: -forwardPower
    };

    ballBody.applyImpulse(impulse, true);

  }


  // OPPOENENT WALL BOUCNME //
  let wallBounceUsed = false;
  let lastWallBounceTime = 0;
  const wallHalfDepth = 0.4;

  function handleOpponentWallBounce() {
    if (!ballBody || !wallBody) return;

    const pos = ballBody.translation();
    const vel = ballBody.linvel();

    const wallCenter = opponentWallCollider.translation();
    const wallFrontZ = wallCenter.z + wallHalfDepth;

    // Distance from wall face
    const dist = Math.abs(pos.z - wallFrontZ);

    // Ball must be moving TOWARD the wall (negative Z velocity)
    const approaching = vel.z < 0;

    if (approaching && dist < 0.10 && !wallBounceUsed) {

      wallBounceUsed = true;
      lastWallBounceTime = performance.now();

      const normalZ = 1;
      const dot = vel.z * normalZ;
      let rz = vel.z - 2 * dot * normalZ;
      rz = Math.abs(rz) * 0.85;


      let sidePower = vel.x * 1.8;


      if (Math.abs(sidePower) < 0.05) {
        sidePower = (Math.random() - 0.5) * 1.2;
      }

      const newVel = {
        x: sidePower,
        y: vel.y,
        z: rz
      };

      ballBody.setLinvel(newVel, true);
    }

    // Reset bounce flag after ball moves away
    if (wallBounceUsed && dist > 0.30) {
      if (performance.now() - lastWallBounceTime > 100) {
        wallBounceUsed = false;
      }
    }
  }


  // ANIMATE FUNCTION //

  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    world.timestep = delta;

    // Racket movement //
    if (racket) {
      if (movement.forward) racket.position.z -= speed;
      if (movement.backward) racket.position.z += speed;
      if (movement.left) racket.position.x -= speed;
      if (movement.right) racket.position.x += speed;

      racket.position.z = THREE.MathUtils.clamp(racket.position.z, 0.8, 3.5);
      racket.position.x = THREE.MathUtils.clamp(racket.position.x, -2.5, 2.5);

      const targetX = racket.position.x * 0.5;
      camera.position.x += (targetX - camera.position.x) * 0.05;
      const lookTarget = new THREE.Vector3(racket.position.x * 0.4, 0.5, 0);
      camera.lookAt(lookTarget);
    }

    // Racket Physics & Visual Sync
    if (racket && racketBody && racketVisualMesh) {
      const pos = racket.position;
      const rot = racket.quaternion;

      // Update the physics body’s transform
      racketBody.setNextKinematicTranslation({ x: pos.x, y: pos.y + 0.8, z: pos.z + 0.15 });
      racketBody.setNextKinematicRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w });

      // Update the visual collider mesh to match physics body
      const rbPos = racketBody.translation();
      const rbRot = racketBody.rotation();

      racketVisualMesh.position.set(rbPos.x, rbPos.y, rbPos.z);
      racketVisualMesh.quaternion.set(rbRot.x, rbRot.y, rbRot.z, rbRot.w);
    }

    if (racket) {
      const newPos = new THREE.Vector3().copy(racket.position);
      racketVelocity.copy(newPos).sub(prevRacketPos).divideScalar(delta);
      prevRacketPos.copy(newPos);
    }

    //Add  Racket impulse
    applyRacketImpulse();



    //Add Wall Impulse
    handleOpponentWallBounce();


    world.step();

    const resetCooldown = 2000;
    
    const t = ballBody.translation();
    const r = ballBody.rotation();
    ballMesh.position.set(t.x, t.y, t.z);
    ballMesh.quaternion.set(r.x, r.y, r.z, r.w);

    checkBallOutOfPlay();

    renderer.render(scene, camera);
  }
  animate();
})(); // End of async function
