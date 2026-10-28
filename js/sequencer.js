import { getCtx, ensureAudio, playSound } from './audio.js';
import { save } from './storage.js';

export const PAD_COUNT = 12;
export const KEYMAP = ['1','2','3','4','q','w','e','r','a','s','d','f'];

export const KIT_LABELS = {
  kick:'Kick', snare:'Snare', clap:'Clap',
  hatClosed:'Hat Closed', hatOpen:'Hat Open',
  tomLow:'Tom Low', tomMid:'Tom Mid', tomHigh:'Tom High',
  rim:'Rim', cowbell:'Cowbell', crash:'Crash', shaker:'Shaker'
};
export const KIT_NAMES = Object.keys(KIT_LABELS);

const DEFAULT_PADS = [
  'kick','snare','clap','hatClosed',
  'kick','snare','hatOpen','rim',
  'tomLow','tomMid','tomHigh','crash'
];

const state = {
  bpm: 100, bars: 1,
  pads: [...DEFAULT_PADS],
  grid: null, steps: 16,
  playing: false, recording: false,
  currentStep: 0, nextNoteTime: 0,
  lastStep: -1, lastStepTime: 0
};

let timerId = null;
export const flashQueue = [];
export const playheadQueue = [];

function setSteps(n) {
  const next = Array.from({ length: PAD_COUNT }, () => new Uint8Array(n));
  if (state.grid) {
    for (let p = 0; p < PAD_COUNT; p++) {
      const len = Math.min(n, state.grid[p].length);
      for (let s = 0; s < len; s++) next[p][s] = state.grid[p][s];
    }
  }
  state.grid = next;
  state.steps = n;
}
setSteps(16);

export function getState() {
  return {
    bpm: state.bpm, bars: state.bars,
    pads: [...state.pads],
    grid: state.grid.map(a => Array.from(a))
  };
}

export function setState(s) {
  if (s.bpm) state.bpm = s.bpm;
  if (s.bars) state.bars = s.bars;
  if (Array.isArray(s.pads) && s.pads.length === PAD_COUNT) state.pads = s.pads;
  setSteps(state.bars * 16);
  if (Array.isArray(s.grid)) {
    for (let p = 0; p < PAD_COUNT; p++) {
      const arr = s.grid[p] || [];
      for (let st = 0; st < Math.min(state.steps, arr.length); st++) {
        state.grid[p][st] = arr[st] ? 1 : 0;
      }
    }
  }
}

export const getPad   = i => state.pads[i];
export const getBpm   = () => state.bpm;
export const getBars  = () => state.bars;
export const getSteps = () => state.steps;
export const isPlaying   = () => state.playing;
export const isRecording = () => state.recording;

export function setPad(i, name) {
  state.pads[i] = name;
  save(getState());
}

export function setBpm(v) {
  state.bpm = Math.max(40, Math.min(240, Math.round(v) || 100));
  save(getState());
  return state.bpm;
}

export function setBars(v) {
  state.bars = v;
  setSteps(v * 16);
  state.currentStep = state.currentStep % state.steps;
  save(getState());
}

export function clearGrid() {
  state.grid.forEach(a => a.fill(0));
  save(getState());
}

export function start() {
  ensureAudio();
  const ctx = getCtx();
  state.playing = true;
  state.currentStep = 0;
  state.nextNoteTime = ctx.currentTime + 0.06;
  state.lastStep = -1;
  flashQueue.length = 0;
  playheadQueue.length = 0;
  if (timerId) clearInterval(timerId);
  timerId = setInterval(scheduler, 25);
  scheduler();
}

export function stop() {
  state.playing = false;
  state.recording = false;
  if (timerId) { clearInterval(timerId); timerId = null; }
  flashQueue.length = 0;
  playheadQueue.length = 0;
  playheadQueue.push({ step: -1, time: 0 }); // sentinel: clear playhead
}

export function toggleRec() {
  ensureAudio();
  if (state.recording) {
    state.recording = false;
  } else {
    state.recording = true;
    if (!state.playing) start();
  }
}

export function recordHit(pad) {
  const ctx = getCtx();
  if (!ctx || state.lastStep < 0) return;
  const stepDur = 60 / state.bpm / 4;
  let s = state.lastStep + Math.round((ctx.currentTime - state.lastStepTime) / stepDur);
  s = ((s % state.steps) + state.steps) % state.steps;
  state.grid[pad][s] = 1;
  save(getState());
}

let taps = [];
export function tap() {
  const now = performance.now();
  taps = taps.filter(t => now - t < 2000);
  taps.push(now);
  if (taps.length >= 2) {
    let sum = 0;
    for (let i = 1; i < taps.length; i++) sum += taps[i] - taps[i - 1];
    setBpm(60000 / (sum / (taps.length - 1)));
  }
}

function scheduler() {
  const ctx = getCtx();
  if (!ctx) return;
  const stepDur = 60 / state.bpm / 4;
  while (state.nextNoteTime < ctx.currentTime + 0.12) {
    const step = state.currentStep;
    const time = state.nextNoteTime;
    for (let p = 0; p < PAD_COUNT; p++) {
      if (state.grid[p][step]) {
        playSound(state.pads[p], time);
        flashQueue.push({ pad: p, time });
      }
    }
    playheadQueue.push({ step, time });
    state.lastStep = step;
    state.lastStepTime = time;
    state.nextNoteTime += stepDur;
    state.currentStep = (state.currentStep + 1) % state.steps;
  }
}
