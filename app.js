// --- Configuración e Inicialización ---
let audioCtx;
let analyser;
let microphone;
const A4_FREQ = 430; // Tu referencia personalizada

// Definición de las cuerdas y sus frecuencias objetivo (A4=430Hz)
const guitarStrings = [
  { note: "E2", freq: 80.54, markerClass: "marker-E2" },
  { note: "A2", freq: 107.50, markerClass: "marker-A2" },
  { note: "D3", freq: 143.49, markerClass: "marker-D3" },
  { note: "G3", freq: 191.55, markerClass: "marker-G3" },
  { note: "B3", freq: 240.20, markerClass: "marker-B3" },
  { note: "E4", freq: 322.14, markerClass: "marker-E4" }
];

// --- Algoritmo de Autocorrelación (DSP) ---
// (Este algoritmo permanece igual, es el motor de detección)
function autoCorrelate(buf, sampleRate) {
  let SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    let val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; // Silencio

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
  let T0 = maxpos;
  return sampleRate / T0;
}

// --- Lógica de la Interfaz de Usuario ---
const startBtn = document.getElementById('start-btn');
const freqDisplay = document.getElementById('detected-freq');
const noteDisplay = document.getElementById('detected-note');
const tuningIndicator = document.getElementById('tuning-indicator');
const noteMarkers = document.querySelectorAll('.note-marker');

startBtn.addEventListener('click', async () => {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    microphone = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    microphone.connect(analyser);

    startBtn.innerText = "Escuchando...";
    startBtn.disabled = true;
    tuningIndicator.style.display = 'block'; // Mostrar indicador

    updatePitch();
  } catch (err) {
    alert("No se pudo acceder al micrófono. Asegúrate de dar permisos.");
  }
});

function updatePitch() {
  const buf = new Float32Array(2048);
  analyser.getFloatTimeDomainData(buf);
  const pitch = autoCorrelate(buf, audioCtx.sampleRate);

  if (pitch !== -1) {
    freqDisplay.innerText = pitch.toFixed(1) + " Hz";
    evaluateTuning(pitch);
  } else {
    // Si no hay sonido, resetear visualmente
    resetVisuals();
  }

  requestAnimationFrame(updatePitch);
}

function evaluateTuning(pitch) {
  let closestString = null;
  let minDiff = Infinity;

  // 1. Encontrar la cuerda más cercana
  guitarStrings.forEach(string => {
    const diff = Math.abs(pitch - string.freq);
    if (diff < minDiff) {
      minDiff = diff;
      closestString = string;
    }
  });

  // 2. Actualizar marcadores de nota (los círculos)
  noteMarkers.forEach(marker => marker.classList.remove('active', 'in-tune'));

  if (closestString && minDiff < 25) { // Tolerancia para identificar cuerda
    const activeMarker = document.querySelector(`.${closestString.markerClass}`);
    activeMarker.classList.add('active');
    noteDisplay.innerText = closestString.note.replace(/\d/, ''); // Mostrar solo 'E', 'A', etc.

    // 3. Mover el indicador de afinación (la bola verde)
    const targetFreq = closestString.freq;
    const freqDiff = pitch - targetFreq;

    // Calcular la posición vertical (top) del indicador
    // Mapeamos la diferencia de frecuencia a un rango de píxeles (0px a 100px)
    // 0px = Muy plano (b), 50px = Afinación perfecta, 100px = Muy afilado (#)
    let indicatorPosPercent = 50 + (freqDiff * 3); // Ajusta el multiplicador (3) para sensibilidad
    
    // Limitar el rango entre 5% y 95% para que no se salga
    indicatorPosPercent = Math.max(5, Math.min(95, indicatorPosPercent));
    
    tuningIndicator.style.top = `${indicatorPosPercent}%`;

    // 4. Estado de "Afinado"
    if (Math.abs(freqDiff) <= 0.7) { // Tolerancia de afinación
      activeMarker.classList.add('in-tune');
      tuningIndicator.style.backgroundColor = '#2ecc71'; // Verde brillante
      tuningIndicator.style.boxShadow = '0 0 15px rgba(46, 204, 113, 0.8)';
    } else {
      // No afinado: Color normal, pero posicionado
      tuningIndicator.style.backgroundColor = '#2ecc71'; 
      tuningIndicator.style.boxShadow = '0 0 10px rgba(46, 204, 113, 0.5)';
    }

  } else {
    // Sonido detectado pero no cerca de ninguna cuerda
    noteDisplay.innerText = "--";
    resetIndicator();
  }
}

function resetVisuals() {
  noteMarkers.forEach(marker => marker.classList.remove('active', 'in-tune'));
  noteDisplay.innerText = "--";
  freqDisplay.innerText = "Toca una cuerda...";
  resetIndicator();
}

function resetIndicator() {
  tuningIndicator.style.top = '50%'; // Volver al centro
  tuningIndicator.style.backgroundColor = '#555'; // Color neutro
  tuningIndicator.style.boxShadow = 'none';
}
