let audioCtx;
let analyser;
let microphone;
const A4_FREQ = 430; // Referencia en 430 Hz

// Algoritmo de Autocorrelación para detectar la frecuencia fundamental
function autoCorrelate(buf, sampleRate) {
  let SIZE = buf.length;
  let rms = 0;

  for (let i = 0; i < SIZE; i++) {
    let val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; // Señal muy débil (silencio)

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

// Iniciar micrófono al hacer clic
document.getElementById('start-btn').addEventListener('click', async () => {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    microphone = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    microphone.connect(analyser);

    document.getElementById('start-btn').innerText = "Escuchando...";
    document.getElementById('start-btn').disabled = true;

    updatePitch();
  } catch (err) {
    alert("No se pudo acceder al micrófono: " + err.message);
  }
});

function updatePitch() {
  const buf = new Float32Array(2048);
  analyser.getFloatTimeDomainData(buf);
  const pitch = autoCorrelate(buf, audioCtx.sampleRate);

  const freqDisplay = document.getElementById('detected-freq');
  const noteDisplay = document.getElementById('detected-note');
  const statusDisplay = document.getElementById('tuning-status');

  if (pitch !== -1) {
    freqDisplay.innerText = pitch.toFixed(1) + " Hz";
    evaluateTuning(pitch);
  } else {
    statusDisplay.innerText = "Toca una cuerda...";
  }

  requestAnimationFrame(updatePitch);
}

// Comparar la frecuencia detectada con la cuerda más cercana a 430 Hz
function evaluateTuning(pitch) {
  const pegs = document.querySelectorAll('.peg');
  let closestPeg = null;
  let minDiff = Infinity;

  pegs.forEach(peg => {
    peg.classList.remove('active', 'in-tune', 'flat', 'sharp');
    const targetFreq = parseFloat(peg.dataset.freq);
    const diff = Math.abs(pitch - targetFreq);

    if (diff < minDiff) {
      minDiff = diff;
      closestPeg = peg;
    }
  });

  if (closestPeg && minDiff < 30) { // Tolerancia para identificar cuerda
    closestPeg.classList.add('active');
    const target = parseFloat(closestPeg.dataset.freq);
    const diff = pitch - target;

    document.getElementById('detected-note').innerText = closestPeg.dataset.note;

    if (Math.abs(diff) <= 0.8) {
      closestPeg.classList.add('in-tune');
      document.getElementById('tuning-status').innerText = "¡Afinado!";
    } else if (diff < 0) {
      closestPeg.classList.add('flat');
      document.getElementById('tuning-status').innerText = "Bajo (Tensa la cuerda)";
    } else {
      closestPeg.classList.add('sharp');
      document.getElementById('tuning-status').innerText = "Alto (Afloja la cuerda)";
    }
  }
}
