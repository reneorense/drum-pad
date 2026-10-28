import { setState } from './sequencer.js';
import { load } from './storage.js';
import { initUI } from './ui.js';

const saved = load();
if (saved) setState(saved);

initUI();
