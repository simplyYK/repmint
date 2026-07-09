"use client";

// usePoseTracker: the bridge between the camera + MediaPipe pose model and
// RepMint's pure tracking library. It owns the webcam stream, the pose model,
// the render loop, and the per-frame pipeline (smooth → measure → rep engine →
// form coach), then publishes a throttled snapshot the Coach UI renders.

import { useCallback, useEffect, useRef, useState } from "react";
import { PoseSmoother } from "../lib/pose/smoothing";
import { SKELETON, SIDE_JOINTS, bestSide, visibilityOf, type Pose } from "../lib/pose/landmarks";
import type { MovementDef, PoseContext, RepPhase } from "../lib/movements/types";
import { RepEngine, type RepEvent } from "../lib/tracking/repEngine";
import { FormCoach, type CoachTone } from "../lib/tracking/formCoach";
import { evaluateSetup, type ExpectedView, type SetupResult } from "../lib/tracking/setupCheck";
import type { CoachConfig, FaultTally } from "../lib/types";

function strictnessScale(s: CoachConfig["strictness"]) {
  return s === "Lenient" ? 0.82 : s === "Strict" ? 1.14 : 1;
}

type PoseLandmarker = {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => { landmarks?: Pose[] };
  close?: () => void;
};

// Pose model quality: "full" is markedly more accurate than "lite" for joint
// angles while still running in real time on a laptop/phone GPU.
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

export type TrackerSnapshot = {
  cameraStatus: string;
  poseStatus: string;
  hasCamera: boolean;
  modelReady: boolean;
  running: boolean;
  isHold: boolean;
  reps: number;
  seconds: number;
  tut: number;
  depth: number; // 0..1
  phase: RepPhase;
  quality: number; // 0..100
  angle: number | null;
  cue: string;
  tone: CoachTone;
  holdValid: boolean;
  motion: string;
  /** The most recent completed rep's metrics (null until the first rep). */
  lastRep: RepEvent | null;
  /** Camera setup diagnostics, evaluated while idle (pre-set). */
  setup: SetupResult | null;
  /** True while the athlete holds a hand above their head (idle only) —
   * the hands-free "start my set" gesture. */
  raiseHand: boolean;
};

export type SetOutcome = {
  reps: number;
  seconds: number;
  tut: number;
  avgRepSeconds?: number;
  faults: FaultTally[];
  source: "pose" | "manual" | "timer";
  repEvents: RepEvent[];
};

const IDLE: TrackerSnapshot = {
  cameraStatus: "Camera not started",
  poseStatus: "Pose model idle",
  hasCamera: false,
  modelReady: false,
  running: false,
  isHold: false,
  reps: 0,
  seconds: 0,
  tut: 0,
  depth: 0,
  phase: "ready",
  quality: 0,
  angle: null,
  cue: "",
  tone: "idle",
  holdValid: false,
  motion: "Ready",
  lastRep: null,
  setup: null,
  raiseHand: false,
};

const PHASE_LABEL: Record<RepPhase, string> = {
  ready: "Ready",
  lowering: "Lowering",
  bottom: "Bottom",
  rising: "Rising",
};

export function usePoseTracker(movement: MovementDef, config: CoachConfig) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const frameRef = useRef<number | null>(null);

  const movementRef = useRef(movement);
  const smootherRef = useRef(new PoseSmoother());
  const engineRef = useRef(new RepEngine(movement, strictnessScale(config.strictness)));
  const coachRef = useRef(
    new FormCoach(movement, { intensity: config.intensity, tutTargetPerRep: config.tutTargetPerRep }),
  );
  const runningRef = useRef(false);
  const startedAtRef = useRef(0);
  const manualRef = useRef(0);
  const sourceRef = useRef<"pose" | "manual" | "timer">("pose");
  const repEventsRef = useRef<RepEvent[]>([]);

  // live values written every frame, published to React at ~12Hz
  const liveRef = useRef<TrackerSnapshot>({ ...IDLE });
  const [snapshot, setSnapshot] = useState<TrackerSnapshot>({ ...IDLE });
  const setupFrameRef = useRef(0);
  const gestureSinceRef = useRef(0);

  // Recreate the pure engines whenever the movement or coaching config changes.
  useEffect(() => {
    movementRef.current = movement;
    smootherRef.current = new PoseSmoother();
    engineRef.current = new RepEngine(movement, strictnessScale(config.strictness));
    coachRef.current = new FormCoach(movement, {
      intensity: config.intensity,
      tutTargetPerRep: config.tutTargetPerRep,
    });
    manualRef.current = 0;
    repEventsRef.current = [];
    runningRef.current = false;
    startedAtRef.current = 0;
    liveRef.current = {
      ...IDLE,
      cameraStatus: liveRef.current.cameraStatus,
      poseStatus: liveRef.current.poseStatus,
      hasCamera: liveRef.current.hasCamera,
      modelReady: liveRef.current.modelReady,
      isHold: movement.mode === "hold",
      cue: movement.setupCue,
    };
    setSnapshot(liveRef.current);
  }, [movement, config.strictness, config.intensity, config.tutTargetPerRep]);

  const drawPose = useCallback((pose: Pose) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = video.clientWidth || 960;
    const h = video.clientHeight || 540;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(183,255,60,0.9)";
    ctx.lineCap = "round";
    for (const [a, b] of SKELETON) {
      const p1 = pose[a];
      const p2 = pose[b];
      if (visibilityOf(p1) < 0.4 || visibilityOf(p2) < 0.4) continue;
      ctx.beginPath();
      ctx.moveTo(p1.x * w, p1.y * h);
      ctx.lineTo(p2.x * w, p2.y * h);
      ctx.stroke();
    }
    ctx.fillStyle = "#48e5c2";
    for (const p of pose) {
      if (visibilityOf(p) < 0.4) continue;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  const detect = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (video && landmarker && video.readyState >= 2) {
      const ts = performance.now();
      try {
        const result = landmarker.detectForVideo(video, ts);
        const raw = result.landmarks?.[0];
        if (raw?.length) {
          const move = movementRef.current;
          const pose = smootherRef.current.filter(raw, ts);
          drawPose(pose);

          const measure = move.measure(pose);
          const frame = engineRef.current.update(measure, ts);
          const side = measure?.side ?? bestSide(pose, move.keyJoints);
          const ctx: PoseContext = {
            pose,
            side,
            quality: frame.quality,
            depth: frame.depth,
            peakDepth: frame.peakDepth,
            phase: frame.phase,
            velocity: frame.velocity,
          };

          if (runningRef.current) {
            const coach = coachRef.current.update(ctx, ts);
            if (frame.repEvent) {
              repEventsRef.current.push(frame.repEvent);
              liveRef.current.lastRep = frame.repEvent;
            }

            const elapsed = startedAtRef.current
              ? Math.round((Date.now() - startedAtRef.current) / 1000)
              : 0;
            liveRef.current = {
              ...liveRef.current,
              running: true,
              isHold: move.mode === "hold",
              reps: frame.reps + manualRef.current,
              seconds: elapsed,
              tut: Math.round(frame.tutSeconds),
              depth: move.mode === "hold" ? (frame.holdValid ? 1 : 0) : frame.depth,
              phase: frame.phase,
              quality: Math.round(frame.quality * 100),
              angle: frame.angle,
              cue: coach.cue,
              tone: coach.tone,
              holdValid: frame.holdValid,
              motion: move.mode === "hold" ? (frame.holdValid ? "Holding" : "Find the line") : PHASE_LABEL[frame.phase],
            };
          } else {
            // Idle (pre-set): run camera-setup diagnostics every ~15 frames so
            // the UI can guide framing/distance/view before the set starts.
            setupFrameRef.current += 1;
            let setup = liveRef.current.setup;
            if (setupFrameRef.current % 15 === 1) {
              const expectedView: ExpectedView = /side/i.test(move.camera)
                ? "side"
                : /front|face/i.test(move.camera)
                  ? "front"
                  : "any";
              // Visibility is judged on the better-tracked side's joints so a
              // correct side-on stance doesn't get flagged for the far side.
              const setupSide = bestSide(pose, move.keyJoints);
              const keyIdxs = move.keyJoints.map((j) => SIDE_JOINTS[setupSide][j]);
              setup = evaluateSetup(pose, keyIdxs, expectedView);
            }
            const nose = pose[0];
            const handUp =
              nose &&
              visibilityOf(nose) > 0.5 &&
              [pose[15], pose[16]].some((w) => w && visibilityOf(w) > 0.5 && w.y < nose.y - 0.05);
            if (handUp) {
              if (!gestureSinceRef.current) gestureSinceRef.current = ts;
            } else {
              gestureSinceRef.current = 0;
            }
            liveRef.current = {
              ...liveRef.current,
              quality: Math.round(frame.quality * 100),
              angle: frame.angle,
              depth: move.mode === "hold" ? 0 : frame.depth,
              setup,
              raiseHand: gestureSinceRef.current > 0 && ts - gestureSinceRef.current > 900,
            };
          }
        }
      } catch {
        liveRef.current = { ...liveRef.current, poseStatus: "Pose model paused" };
      }
    }
    frameRef.current = requestAnimationFrame(detect);
  }, [drawPose]);

  // Publish snapshot to React at ~12Hz (smooth enough, avoids per-frame renders).
  useEffect(() => {
    const id = window.setInterval(() => setSnapshot({ ...liveRef.current }), 84);
    return () => window.clearInterval(id);
  }, []);

  const setStatus = (patch: Partial<TrackerSnapshot>) => {
    liveRef.current = { ...liveRef.current, ...patch };
    setSnapshot({ ...liveRef.current });
  };

  const startCamera = useCallback(async () => {
    try {
      setStatus({ cameraStatus: "Requesting camera..." });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus({ hasCamera: true, cameraStatus: "Camera ready", poseStatus: "Loading pose model..." });
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const resolver = await vision.FilesetResolver.forVisionTasks(WASM_URL);
        const landmarker = await vision.PoseLandmarker.createFromOptions(resolver, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        landmarkerRef.current = landmarker as PoseLandmarker;
        setStatus({ modelReady: true, poseStatus: "Pose tracking ready" });
        if (frameRef.current == null) frameRef.current = requestAnimationFrame(detect);
      } catch {
        setStatus({ poseStatus: "Pose model unavailable. Manual mode ready." });
      }
    } catch {
      setStatus({ hasCamera: false, cameraStatus: "Camera blocked. Manual mode ready." });
    }
  }, [detect]);

  const startSet = useCallback(() => {
    const move = movementRef.current;
    gestureSinceRef.current = 0;
    engineRef.current.reset();
    coachRef.current.reset();
    smootherRef.current.reset();
    manualRef.current = 0;
    repEventsRef.current = [];
    sourceRef.current = move.mode === "hold" ? "timer" : "pose";
    startedAtRef.current = Date.now();
    runningRef.current = true;
    setStatus({
      running: true,
      raiseHand: false,
      reps: 0,
      seconds: 0,
      tut: 0,
      depth: 0,
      motion: "Tracking",
      cue: landmarkerRef.current ? "Tracking started — move with control." : "Manual mode: tap +1 after each clean rep.",
    });
  }, []);

  const manualRep = useCallback(() => {
    manualRef.current += 1;
    sourceRef.current = "manual";
    setStatus({ reps: engineRef.current.repCount + manualRef.current, cue: "Rep saved — match that range next time." });
  }, []);

  const endSet = useCallback((): SetOutcome => {
    runningRef.current = false;
    const move = movementRef.current;
    const engineReps = engineRef.current.repCount;
    const reps = engineReps + manualRef.current;
    const events = repEventsRef.current;
    const avgRep = events.length
      ? Math.round((events.reduce((s, e) => s + e.durationSeconds, 0) / events.length) * 100) / 100
      : undefined;
    const faults = coachRef.current.faultSummary();
    const seconds = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : liveRef.current.seconds;
    const source: SetOutcome["source"] =
      move.mode === "hold" ? "timer" : manualRef.current > 0 && engineReps === 0 ? "manual" : "pose";
    setStatus({ running: false, motion: "Set complete" });
    return {
      reps,
      seconds,
      tut: Math.round(liveRef.current.tut),
      avgRepSeconds: avgRep,
      faults,
      source,
      repEvents: events,
    };
  }, []);

  const resetSet = useCallback(() => {
    const move = movementRef.current;
    runningRef.current = false;
    engineRef.current.reset();
    coachRef.current.reset();
    manualRef.current = 0;
    repEventsRef.current = [];
    startedAtRef.current = 0;
    setStatus({
      running: false,
      reps: 0,
      seconds: 0,
      tut: 0,
      depth: 0,
      phase: "ready",
      motion: "Ready",
      cue: move.setupCue,
      tone: "idle",
    });
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close?.();
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    snapshot,
    startCamera,
    startSet,
    endSet,
    resetSet,
    manualRep,
  };
}
