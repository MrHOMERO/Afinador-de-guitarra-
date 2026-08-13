let audioCtx = null;
let analyser = null;
let microphone = null;
let mediaStream = null;
let isListening = false;
let animationId = null;

// Presets de Afinaciones basados en A4 = 430 Hz
const TUNING_PRESETS = {
  standard: [
    { stringNum: 6, note: "E2", displayNote: "E", freq: 80.54, markerId: "m-6" },
    { stringNum: 5, note: "A2", displayNote: "A", freq: 107.50, markerId: "m-5" },
    { stringNum: 4, note: "D3", displayNote: "D", freq: 143.49, markerId: "m-4" },
    { stringNum: 3, note: "G3", displayNote: "G", freq: 191.55, markerId: "m-3" },
    { stringNum: 2, note: "B3", displayNote: "B", freq: 240.20, markerId: "m-2" },
    { stringNum: 1, note: "E4", displayNote: "E", freq: 322.14, markerId: "m-1" }
  ],
  c_standard: [
    { stringNum: 6, note: "C2", displayNote: "C", freq: 63.92, markerId: "m-6" },
    { stringNum: 5, note: "F2", displayNote: "F", freq: 85.32, markerId: "m-5" },
    { stringNum: 4, note: "A#2", displayNote: "A#", freq: 113.88, markerId: "m-4" },
    { stringNum: 3, note: "D#3", displayNote: "D#", freq: 152.03, markerId: "m-3" },
    { stringNum: 2, note: "G3", displayNote: "G", freq: 191.55, markerId: "m-2" },
    { stringNum: 1, note: "C4", displayNote: "C", freq: 255.67, markerId: "m-1" }
  ]
};

let currentTuning = TUNING_PRESETS.standard;

// Cambiar afinación según la selección
const tuningSelect = document.getElementById('tuning-select');
tuningSelect.addEventListener('change', (e) => {
  const selected = e.target.value;
  currentTuning = TUNING_PRESETS[selected];
  updateMarkerLabels();
  resetVisuals();
});

function updateMarkerLabels() {
  currentTuning.forEach(s => {
    const el = document.getElementById(s.markerId);
    if (el) el.innerText = s.displayNote;
  });
}

// Algoritmo Autocorrelación
function autoCorrelate(buf, sampleRate) {
  let SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1, thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  }
  buf = buf.slice(r1, r2);
  SIZE = buf.length;

  let c = new Array(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE - i; j++) {
      c[i] = c[i] + buf[j] * buf[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  return sampleRate / maxpos;
}

// Control del Micrófono (Toggle)
const startBtn = document.getElementById('start-btn');

startBtn.addEventListener('click', async () => {
  if (!isListening) {
    await startListening();
  } else {
    stopListening();
  }
});

async function startListening() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    microphone = audioCtx.createMediaStreamSource(mediaStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    microphone.connect(analyser);

    isListening = true;
    startBtn.innerText = "Detener";
    startBtn.classList.add('active');

    updatePitch();
  } catch (err) {
    alert("Error al acceder al micrófono: " + err.message);
  }
}

function stopListening() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
  }
  if (audioCtx) {
    audioCtx.close();
  }
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  isListening = false;
  startBtn.innerText = "Iniciar";
  startBtn.classList.remove('active');
  resetVisuals();
}

function updatePitch() {
  if (!isListening) return;

  const buf = new Float32Array(2048);
  analyser.getFloatTimeDomainData(buf);
  const pitch = autoCorrelate(buf, audioCtx.sampleRate);

  if (pitch !== -1) {
    document.getElementById('detected-freq').innerText = pitch.toFixed(1) + " Hz";
    evaluateTuning(pitch);
  } else {
    resetVisuals(false);
  }

  animationId = requestAnimationFrame(updatePitch);
}

function evaluateTuning(pitch) {
  let closestString = null;
  let minDiff = Infinity;

  // Evaluar contra la afinación seleccionada actualmente
  currentTuning.forEach(string => {
    const diff = Math.abs(pitch - string.freq);
    if (diff < minDiff) {
      minDiff = diff;
      closestString = string;
    }
  });

  const noteMarkers = document.querySelectorAll('.note-marker');
  const arrowLeft = document.getElementById('arrow-left');
  const arrowRight = document.getElementById('arrow-right');
  const instruction = document.getElementById('action-instruction');
  const indicator = document.getElementById('tuning-indicator');

  noteMarkers.forEach(m => m.classList.remove('active', 'in-tune'));
  arrowLeft.classList.remove('active');
  arrowRight.classList.remove('active');

  if (closestString && minDiff < 25) {
    const activeMarker = document.getElementById(closestString.markerId);
    if (activeMarker) activeMarker.classList.add('active');
    
    document.getElementById('detected-note').innerText = closestString.displayNote;

    const diff = pitch - closestString.freq;

    // Posición horizontal del indicador
    let posPercent = 50 + (diff * 4);
    posPercent = Math.max(5, Math.min(95, posPercent));
    indicator.style.left = `${posPercent}%`;

    // Evaluación del tono
    if (Math.abs(diff) <= 0.8) { // AFINADO
      if (activeMarker) activeMarker.classList.add('in-tune');
      indicator.style.backgroundColor = '#2ecc71';
      instruction.innerText = "¡Afinado!";
      instruction.style.color = '#2ecc71';
    } else if (diff < 0) { // BAJO -> Tensar
      arrowLeft.classList.add('active');
      indicator.style.backgroundColor = '#f39c12';
      instruction.innerText = "Tensar cuerda";
      instruction.style.color = '#f39c12';
    } else { // ALTO -> Aflojar
      arrowRight.classList.add('active');
      indicator.style.backgroundColor = '#f39c12';
      instruction.innerText = "Aflojar cuerda";
      instruction.style.color = '#f39c12';
    }
  } else {
    document.getElementById('detected-note').innerText = "--";
    instruction.innerText = "Toca una cuerda...";
    instruction.style.color = "#aaa";
    indicator.style.left = '50%';
    indicator.style.backgroundColor = '#777';
  }
}

function resetVisuals(resetFreq = true) {
  document.querySelectorAll('.note-marker').forEach(m => m.classList.remove('active', 'in-tune'));
  document.getElementById('arrow-left').classList.remove('active');
  document.getElementById('arrow-right').classList.remove('active');
  document.getElementById('detected-note').innerText = "--";
  document.getElementById('action-instruction').innerText = "Toca una cuerda...";
  document.getElementById('action-instruction').style.color = "#aaa";
  
  const indicator = document.getElementById('tuning-indicator');
  indicator.style.left = '50%';
  indicator.style.backgroundColor = '#777';

  if (resetFreq) {
    document.getElementById('detected-freq').innerText = "0.0 Hz";
  }
}

// Inicializar etiquetas
updateMarkerLabels();
