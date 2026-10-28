import { getCtx, ensureAudio, playSound, setVolume } from './audio.js';
import {
  PAD_COUNT, KEYMAP, KIT_NAMES, KIT_LABELS,
  getPad, getBpm, getBars, getSteps, isPlaying, isRecording,
  setPad, setBpm, setBars, start, stop, toggleRec, tap, clearGrid,
  recordHit, flashQueue, playheadQueue
} from './sequencer.js';

const padsEl    = document.getElementById('pads');
const stripEl   = document.getElementById('strip');
const playBtn   = document.getElementById('playBtn');
const recBtn    = document.getElementById('recBtn');
const clearBtn  = document.getElementById('clearBtn');
const bpmEl     = document.getElementById('bpm');
const tapBtn    = document.getElementById('tapBtn');
const barsEl    = document.getElementById('bars');
const assignBtn = document.getElementById('assignBtn');
const volEl     = document.getElementById('vol');

const padEls = [];
const flashTimers = new Array(PAD_COUNT).fill(0);
let playheadEls = [];
let activeStep = -1;

/* ---------- render ---------- */
function buildPads() {
  for (let i = 0; i < PAD_COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'pad';
    el.style.setProperty('--h', 190 + i * 14);

    el.innerHTML =
      '<span class="lbl"></span>' +
      '<span class="key">' + KEYMAP[i].toUpperCase() + '</span>' +
      '<select class="snd" aria-label="Pad ' + (i + 1) + ' sound"></select>';

    const sel = el.querySelector('select');
    KIT_NAMES.forEach(name => {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = KIT_LABELS[name];
      sel.appendChild(o);
    });
    sel.value = getPad(i);
    el.querySelector('.lbl').textContent = KIT_LABELS[getPad(i)];

    sel.addEventListener('change', () => {
      setPad(i, sel.value);
      el.querySelector('.lbl').textContent = KIT_LABELS[sel.value];
      ensureAudio();
      playSound(sel.value);
    });

    el.addEventListener('pointerdown', e => {
      if (document.body.classList.contains('assign')) return;
      e.preventDefault();
      pressPad(i);
    });

    padsEl.appendChild(el);
    padEls.push(el);
  }
}

function renderStrip() {
  stripEl.innerHTML = '';
  playheadEls = [];
  const steps = getSteps();
  for (let s = 0; s < steps; s++) {
    const d = document.createElement('div');
    d.className = 'tick' + (s % 4 === 0 ? ' beat' : '');
    stripEl.appendChild(d);
    playheadEls.push(d);
  }
  activeStep = -1;
}

/* ---------- pad actions ---------- */
function pressPad(i) {
  ensureAudio();
  playSound(getPad(i));
  flashPad(i);
  recordHit(i);
}

function flashPad(i) {
  const el = padEls[i];
  if (!el) return;
  el.classList.add('hit');
  clearTimeout(flashTimers[i]);
  flashTimers[i] = setTimeout(() => el.classList.remove('hit'), 80);
}

function setPlayhead(s) {
  if (activeStep >= 0 && playheadEls[activeStep]) playheadEls[activeStep].classList.remove('on');
  activeStep = s;
  if (s >= 0 && playheadEls[s]) playheadEls[s].classList.add('on');
}

/* ---------- transport UI ---------- */
function updateTransportUI() {
  playBtn.textContent = isPlaying() ? '❚❚ Stop' : '▶ Play';
  playBtn.classList.toggle('on', isPlaying());
  recBtn.textContent = isRecording() ? '● Rec…' : '● Rec';
  recBtn.classList.toggle('on', isRecording());
}

function togglePlay() {
  ensureAudio();
  if (isPlaying()) { stop(); setPlayhead(-1); }
  else             { start(); }
  updateTransportUI();
}

/* ---------- animation loop ---------- */
function tick() {
  requestAnimationFrame(tick);
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  while (flashQueue.length && flashQueue[0].time <= now) {
    flashPad(flashQueue.shift().pad);
  }
  while (playheadQueue.length && playheadQueue[0].time <= now) {
    const item = playheadQueue.shift();
    if (item.step === -1) setPlayhead(-1);
    else                  setPlayhead(item.step);
  }
}

/* ---------- wiring ---------- */
function initControls() {
  bpmEl.value = getBpm();
  barsEl.value = String(getBars());

  playBtn.addEventListener('click', togglePlay);

  recBtn.addEventListener('click', () => {
    ensureAudio();
    toggleRec();
    updateTransportUI();
  });

  clearBtn.addEventListener('click', () => clearGrid());

  tapBtn.addEventListener('click', () => {
    tap();
    bpmEl.value = getBpm();
  });

  bpmEl.addEventListener('input', () => {
    bpmEl.value = setBpm(+bpmEl.value);
  });

  barsEl.addEventListener('change', () => {
    setBars(+barsEl.value);
    renderStrip();
  });

  assignBtn.addEventListener('click', () => {
    const on = document.body.classList.toggle('assign');
    assignBtn.classList.toggle('on', on);
    assignBtn.textContent = on ? 'Done' : 'Assign sounds';
  });

  volEl.addEventListener('input', () => setVolume(+volEl.value));

  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.target.matches('input,select,textarea')) return;

    const idx = KEYMAP.indexOf(e.key.toLowerCase());
    if (idx >= 0) { e.preventDefault(); pressPad(idx); return; }
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.key.toLowerCase() === 'r') { e.preventDefault(); toggleRec(); updateTransportUI(); }
  });
}

export function initUI() {
  buildPads();
  renderStrip();
  initControls();
  updateTransportUI();
  requestAnimationFrame(tick);
      }
