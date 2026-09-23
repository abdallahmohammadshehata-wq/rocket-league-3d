import * as THREE from 'three';
import { Car } from '../entities/Car';
import { Ball } from '../entities/Ball';
import { Stadium } from '../arena/Stadium';
import { InputState } from '../input/InputManager';

export type BotDifficulty = 'ROOKIE' | 'PRO' | 'ALL_STAR' | 'OFF';

export class BotAI {
  public difficulty: BotDifficulty = 'PRO';
  private car: Car;
  private ball: Ball;
  private stadium: Stadium;

  private jumpCooldown: number = 0;
  // Orange Bot attacks Blue Goal (-Z = -50) and defends Orange Goal (+Z = +50)
  private readonly targetGoalPos: THREE.Vector3 = new THREE.Vector3(0, 3, -50);
  private readonly ownGoalPos: THREE.Vector3 = new THREE.Vector3(0, 3, 50);

  constructor(car: Car, ball: Ball, stadium: Stadium, difficulty: BotDifficulty = 'PRO') {
    this.car = car;
    this.ball = ball;
    this.stadium = stadium;
    this.difficulty = difficulty;
  }

  public update(dt: number, isKickoff: boolean, isGoalReplay: boolean): InputState {
    if (this.difficulty === 'OFF' || isKickoff || isGoalReplay) {
      return {
        throttle: 0,
        steer: 0,
        pitch: 0,
        yaw: 0,
        roll: 0,
        jump: false,
        jumpJustPressed: false,
        boost: false,
        handbrake: false,
        toggleCamera: false,
        usePowerup: false
      };
    }

    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);

    const carPos = this.car.getPosition();
    const ballPos = this.ball.getPosition();
    const ballVel = this.ball.getVelocity();
    const carForward = this.car.getForward();
    const distToBall = carPos.distanceTo(ballPos);

    // 1. Predict Ball Trajectory (Lead the shot)
    const leadTime = this.difficulty === 'ROOKIE' ? 0.25 : this.difficulty === 'PRO' ? 0.55 : 0.85;
    const predictedBallPos = ballPos.clone().add(ballVel.clone().multiplyScalar(leadTime));
    predictedBallPos.y = Math.min(predictedBallPos.y, 7.5);

    // 2. Tactical State & Target Selection
    let targetPos: THREE.Vector3;

    // Is the ball threatening own goal (+Z)?
    const isThreateningOwnGoal = (ballPos.z > 0 && ballVel.z > 2.0) || ballPos.z > 25;

    if (isThreateningOwnGoal && carPos.z < ballPos.z) {
      // Rotate back towards own goal to defend and make a clearance
      targetPos = this.ownGoalPos.clone().lerp(ballPos, 0.45);
    } else {
      // Attack Line: strike through the ball directly toward the Blue Goal (-Z)
      const ballToGoal = new THREE.Vector3().subVectors(this.targetGoalPos, predictedBallPos).normalize();
      // Position slightly behind the ball relative to the goal vector
      targetPos = predictedBallPos.clone().sub(ballToGoal.multiplyScalar(2.4));
    }

    // 3. Compute Steering & Angle to Target
    const dirToTarget = new THREE.Vector3().subVectors(targetPos, carPos);
    dirToTarget.y = 0;
    if (dirToTarget.lengthSq() < 0.001) {
      dirToTarget.set(0, 0, -1);
    }
    dirToTarget.normalize();

    // Normalized 2D forward vector in XZ plane
    const forwardXZ = new THREE.Vector3(carForward.x, 0, carForward.z).normalize();
    const dot = Math.max(-1, Math.min(1, forwardXZ.dot(dirToTarget)));
    const crossY = forwardXZ.x * dirToTarget.z - forwardXZ.z * dirToTarget.x;
    const angleDiff = Math.atan2(crossY, dot);

    // Steer proportional to angle difference
    const steerGain = this.difficulty === 'ROOKIE' ? 2.2 : this.difficulty === 'PRO' ? 3.4 : 4.2;
    const steer = Math.max(-1, Math.min(1, angleDiff * steerGain));
    const handbrake = Math.abs(angleDiff) > 1.35 && this.difficulty !== 'ROOKIE';

    // 4. Throttle & Boost
    let throttle = 1.0;
    if (Math.abs(angleDiff) > 2.2 && distToBall > 14) {
      throttle = 0.6; // ease off throttle during tight 180 turns
    }

    const isLinedUp = Math.abs(angleDiff) < 0.38;
    const wantsBoost = isLinedUp && (distToBall > 6 || this.difficulty === 'ALL_STAR') && this.car.boostAmount > 5;

    // 5. Jump & Dodge (Flip Shot)
    let jump = false;
    let jumpJustPressed = false;

    if (this.jumpCooldown <= 0 && distToBall < 5.8) {
      if (ballPos.y > 2.6 && ballPos.y < 7.0 && this.car.isGrounded) {
        // Aerial Jump for high ball
        jump = true;
        jumpJustPressed = true;
        this.jumpCooldown = 1.1;
      } else if (!this.car.isGrounded && isLinedUp && distToBall < 4.6) {
        // Forward Dodge Flip into ball!
        jump = true;
        jumpJustPressed = true;
        this.jumpCooldown = 1.4;
      }
    }

    return {
      throttle: jump && !this.car.isGrounded && distToBall < 4.6 ? 1 : throttle,
      steer,
      pitch: 0,
      yaw: steer,
      roll: 0,
      jump,
      jumpJustPressed,
      boost: wantsBoost,
      handbrake,
      toggleCamera: false,
      usePowerup: Math.random() < 0.02
    };
  }
}
