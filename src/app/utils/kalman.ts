/**
 * A simple 2D constant‐velocity Kalman filter for smoothing (x,y) positions.
 * Usage:
 *   import { SimpleKalman2D, KalmanState } from '../utils/kalman';
 *   const kf = new SimpleKalman2D(dtSeconds, procStd, measStd);
 *   let state: KalmanState = kf.init(x0, y0);
 *   // on each new raw measurement:
 *   state = kf.predict(state);
 *   state = kf.update(state, measX, measY);
 *   // state.x, state.y are the smoothed positions
 */

/** The internal Kalman state */
export interface KalmanState {
  x: number;      // filtered x
  y: number;      // filtered y
  vx: number;     // velocity x
  vy: number;     // velocity y
  P: number[][];  // 4×4 covariance matrix
}

export class SimpleKalman2D {
  private F: number[][];
  private H: number[][];
  private Q: number[][];
  private R: number[][];

  constructor(
    private dt: number = 1,          // seconds between steps
    processStd: number = 0.5,         // process noise std (m/s²)
    measurementStd: number = 1.0      // measurement noise std (m)
  ) {
    // State‐transition matrix
    this.F = [
      [1, 0, this.dt, 0],
      [0, 1, 0, this.dt],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    // Measurement matrix
    this.H = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
    ];
    // Process noise covariance Q
    const q2 = processStd * processStd;
    const dt2 = this.dt * this.dt,
      dt3 = dt2 * this.dt,
      dt4 = dt3 * this.dt;
    this.Q = [
      [dt4 / 4 * q2, 0, dt3 / 2 * q2, 0],
      [0, dt4 / 4 * q2, 0, dt3 / 2 * q2],
      [dt3 / 2 * q2, 0, dt2 * q2, 0],
      [0, dt3 / 2 * q2, 0, dt2 * q2],
    ];
    // Measurement noise covariance R
    const r2 = measurementStd * measurementStd;
    this.R = [[r2, 0], [0, r2]];
  }

  // Initialize state at first measurement
  public init(x0: number, y0: number): KalmanState {
    return {
      x: x0,
      y: y0,
      vx: 0,
      vy: 0,
      P: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ]
    };
  }

  // Predict step: projects state ahead
  public predict(state: KalmanState): KalmanState {
    const xv = [[state.x], [state.y], [state.vx], [state.vy]];
    const xPred = this.matMul(this.F, xv).map(r => r[0]);
    // P = F·P·Fᵀ + Q
    const FP = this.matMul(this.F, state.P);
    const PPred = this.matAdd(
      this.matMul(FP, this.transpose(this.F)),
      this.Q
    );
    return { x: xPred[0], y: xPred[1], vx: xPred[2], vy: xPred[3], P: PPred };
  }

  // Update step: incorporate a new (x,y) measurement
  public update(state: KalmanState, measX: number, measY: number): KalmanState {
    const z = [[measX], [measY]];
    const xv = [[state.x], [state.y], [state.vx], [state.vy]];
    const Hx = this.matMul(this.H, xv);
    const y = [[z[0][0] - Hx[0][0]], [z[1][0] - Hx[1][0]]];
    // S = H·P·Hᵀ + R
    const HP = this.matMul(this.H, state.P);
    const S = this.matAdd(
      this.matMul(HP, this.transpose(this.H)),
      this.R
    );
    // K = P·Hᵀ·S⁻¹
    const PHT = this.matMul(state.P, this.transpose(this.H));
    const K = this.matMul(PHT, this.inv2(S)); // 4×2
    // x_new = x_pred + K·y
    const Ky = this.matMul(K, y).map(r => r[0]);
    const xNew = [state.x, state.y, state.vx, state.vy].map((v, i) => v + Ky[i]);
    // P_new = (I - K·H)·P
    const I4 = [[1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]];
    const KH = this.matMul(K, this.H);
    const IKH = this.matAdd(I4, KH, true);
    const PNew = this.matMul(IKH, state.P);
    return { x: xNew[0], y: xNew[1], vx: xNew[2], vy: xNew[3], P: PNew };
  }

  // —————— linear algebra helpers ——————
  private matMul(A: number[][], B: number[][]): number[][] { /*…*/
    const m = A.length, n = A[0].length, p = B[0].length;
    const C = Array.from({ length: m }, () => Array(p).fill(0));
    for (let i = 0; i < m; i++)for (let j = 0; j < p; j++)for (let k = 0; k < n; k++)C[i][j] += A[i][k] * B[k][j];
    return C;
  }
  private transpose(M: number[][]): number[][] { return M[0].map((_, i) => M.map(r => r[i])); }
  private matAdd(A: number[][], B: number[][], sub = false): number[][] {
    return A.map((row, i) => row.map((v, j) => v + (sub ? -B[i][j] : B[i][j])));
  }
  private inv2(M: number[][]): number[][] {
    const [[a, b], [c, d]] = M, det = a * d - b * c;
    return [[d / det, -b / det], [-c / det, a / det]];
  }
}
