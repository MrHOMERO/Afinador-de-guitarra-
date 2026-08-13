let audioCtx = null;
let analyser = null;
let microphone = null;
let mediaStream = null;
let isListening = false;
let animationId = null;

const guitarStrings = [
  { note: "E2", freq: 80.54, markerClass: "marker-E2" },
  { note: "A2", freq: 107.50, markerClass: "marker-A2" },
  { note: "D3", freq: 143.49, markerClass: "marker-D3" },
  { note: "G3", freq: 191.55, markerClass: "marker-G3" },
  { note: "B3", freq: 240.20, markerClass: "marker-B3" },
  { note: "E4", freq: 322.14, markerClass: "marker-E4" }
];

// Algoritmo para calcular la frecuencia (Pitch Detection)
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

// Botón Toggle: Iniciar / Apagar Micrófono
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

  guitarStrings.forEach(string => {
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
    const activeMarker = document.querySelector(`.${closestString.markerClass}`);
    activeMarker.classList.add('active');
    document.getElementById('detected-note').innerText = closestString.note.replace(/\d/, '');

    const diff = pitch - closestString.freq;

    // Posición horizontal del indicador (0% a 100%)
    let posPercent = 50 + (diff * 4);
    posPercent = Math.max(5, Math.min(95, posPercent));
    indicator.style.left = `${posPercent}%`;

    // Evaluación del tono
    if (Math.abs(diff) <= 0.8) { // ¡AFINADO!
      activeMarker.classList.add('in-tune');
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
