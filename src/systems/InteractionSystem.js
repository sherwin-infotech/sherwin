import * as THREE from 'three';
import { ORB_CONFIG } from '../constants';
import { audioSystem } from './AudioSystem';

class InteractionSystem {
  constructor() {
    this.currentPos = new THREE.Vector3(...ORB_CONFIG.initialPosition);
    this.targetPos = new THREE.Vector3(...ORB_CONFIG.initialPosition);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.isMovingToTarget = false;
    this.activeWaves = [];
    this.listeners = new Set();
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // Z=0 plane
    this.impactCount = 0;
    this.lastImpactPos = new THREE.Vector3();
    this.lastImpactTime = 0;
    this.lastUserInteractionTime = 0;
    this.lastThunderTime = -100;
    this.autoCycleInterval = 11.5; // Seconds between automatic background cycles
    this.initialAutoTriggered = false;
    this.isThunderActive = false;
    this.currentTime = 0;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, data) {
    this.listeners.forEach((listener) => {
      try {
        listener(event, data);
      } catch (err) {
        console.error('InteractionSystem listener error:', err);
      }
    });
  }

  setTargetPoint(point, isAuto = false) {
    if (!isAuto) {
      this.lastUserInteractionTime = this.currentTime;
    }
    this.targetPos.copy(point);
    this.targetPos.x = Math.max(-16, Math.min(16, this.targetPos.x));
    this.targetPos.y = Math.max(-10, Math.min(10, this.targetPos.y));
    this.targetPos.z = Math.max(-6, Math.min(4, this.targetPos.z));
    this.isMovingToTarget = true;
    this.currentMoveIsAuto = isAuto;
    audioSystem.playLaunchChirp();
    this.notify('target_set', { target: this.targetPos.clone(), isAuto });
  }

  // Pointer click handler
  handlePointerDown(screenX, screenY, camera = this.camera) {
    if (!camera) return;
    this.lastUserInteractionTime = this.currentTime;
    const ndcX = (screenX / window.innerWidth) * 2 - 1;
    const ndcY = -(screenY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const intersectionPoint = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.plane, intersectionPoint);

    if (hit) {
      this.setTargetPoint(intersectionPoint, false);
    }
  }

  // Update spring physics on frame tick
  update(delta, time) {
    this.currentTime = time;

    if (this.isMovingToTarget) {
      // Calculate spring displacement
      const displacement = new THREE.Vector3().subVectors(this.targetPos, this.currentPos);
      const distance = displacement.length();

      if (distance < 0.14) {
        // Arrived at target: Snap & trigger echolocation impact
        this.currentPos.copy(this.targetPos);
        this.velocity.set(0, 0, 0);
        this.isMovingToTarget = false;
        this.triggerImpact(this.targetPos.clone(), time, this.currentMoveIsAuto);
      } else {
        // Smooth damped harmonic spring physics
        const force = displacement.multiplyScalar(ORB_CONFIG.springStiffness * (60 * delta));
        this.velocity.add(force);
        this.velocity.multiplyScalar(Math.pow(ORB_CONFIG.springDamping, delta * 60));
        this.currentPos.addScaledVector(this.velocity, delta * 60);
      }
    } else {
      // Subtle organic idle float when resting
      const floatOffsetY = Math.sin(time * ORB_CONFIG.idleFloatFrequency) * ORB_CONFIG.idleFloatAmplitude * delta;
      const floatOffsetX = Math.cos(time * ORB_CONFIG.idleFloatFrequency * 0.7) * (ORB_CONFIG.idleFloatAmplitude * 0.5) * delta;
      this.currentPos.y += floatOffsetY;
      this.currentPos.x += floatOffsetX;

      // Automatic background cycle:
      // 1. Initial thunder + animation at ~2.8s
      // 2. Periodic background cycles when idle
      const idleTime = time - Math.max(this.lastImpactTime, this.lastUserInteractionTime, this.lastThunderTime);
      if (!this.initialAutoTriggered && time > 2.8) {
        this.initialAutoTriggered = true;
        this.triggerThunder(time, true);
      } else if (this.initialAutoTriggered && idleTime > this.autoCycleInterval && !this.isMovingToTarget && this.activeWaves.length === 0) {
        this.triggerThunder(time, true);
      }
    }

    // Age and prune finished waves
    for (let i = this.activeWaves.length - 1; i >= 0; i--) {
      const wave = this.activeWaves[i];
      wave.age += delta;
      if (wave.age > wave.maxDuration) {
        this.activeWaves.splice(i, 1);
      }
    }
  }

  // Thunder event followed by automated background echolocation reveal animation
  triggerThunder(time = this.currentTime, isAuto = true) {
    this.lastThunderTime = time;
    this.isThunderActive = true;

    // 1. Procedural rolling thunder audio
    audioSystem.playThunder();

    // 2. Notify visual systems (lightning flash on CaveEnvironment, startled Bats, Atmosphere)
    this.notify('thunder', {
      time,
      duration: 0.48,
      isAuto,
    });

    // 3. At ~360ms (as lightning flash settles), automatically launch seed to a prominent rock feature
    setTimeout(() => {
      const autoRockTargets = [
        new THREE.Vector3(-5.8, 0.5, -2.0),  // Left cavern rock wall & stalactites
        new THREE.Vector3(0.5, -3.5, -2.2),  // Subterranean floor stalagmites
        new THREE.Vector3(-1.5, 3.2, -1.8),  // Cavern roof stalactites
        new THREE.Vector3(4.6, -0.6, -2.0),  // Right cavern column & alcove
      ];
      const target = autoRockTargets[this.impactCount % autoRockTargets.length];
      this.setTargetPoint(target, isAuto);
      this.isThunderActive = false;
    }, 360);
  }

  // Create multi-layer echolocation impact
  triggerImpact(position, time, isAuto = false) {
    this.impactCount++;
    this.lastImpactPos.copy(position);
    this.lastImpactTime = time;

    // Trigger audio impact & echo
    audioSystem.playEcholocationImpact();

    // Create 4 staggered expanding acoustic wave layers
    const delays = [0, 0.12, 0.26, 0.45];
    const newWaveGroup = {
      id: this.impactCount,
      origin: position.clone(),
      startTime: time,
      delays,
      maxDuration: 2.5,
      age: 0.001,
      isAuto,
    };

    this.activeWaves.push(newWaveGroup);

    // Notify particle system, bat entities, and cave shader
    this.notify('echolocation_impact', {
      origin: position.clone(),
      time,
      impactId: this.impactCount,
      isAuto,
    });
  }
}

export const interactionSystem = new InteractionSystem();
if (typeof window !== 'undefined') {
  window.__batCloud = interactionSystem;
}
