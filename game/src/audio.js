// Coral Bay Heat — all sound is synthesised with WebAudio: no audio files.
// Short envelopes for the effects (gunshot, crash, cash, siren, engine) and a
// tiny step-sequenced bass-and-keys loop for the music. Nothing starts until
// the player's first key or click, which is when browsers allow audio.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenPhase = 0;
  let musicTimer = 0;
  let musicStep = 0;
  let enabled = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      enabled = true;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!enabled || !ensure()) return;
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, freq, delay) {
    if (!enabled || !ensure()) return;
    const t0 = ctx.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq || 1200;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  // A lazy I–VI–III–VII groove in A minor: bass on the beat, soft keys between.
  const BASS = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 73.4, 0, 61.7, 0];
  const KEYS = [220, 261.6, 329.6, 261.6, 174.6, 220, 261.6, 220, 196, 246.9, 293.7, 246.9, 164.8, 196, 246.9, 196];

  return {
    unlock() {
      ensure();
    },
    shot() {
      noise(0.09, 0.5, 2600);
      tone(160, 0.08, 'square', 0.25, 60);
    },
    punch() {
      noise(0.06, 0.3, 700);
    },
    hit() {
      tone(110, 0.1, 'sawtooth', 0.3, 55);
    },
    crash(big) {
      noise(big ? 0.35 : 0.16, big ? 0.6 : 0.35, 500);
      tone(70, 0.2, 'triangle', 0.4, 40);
    },
    cash() {
      tone(880, 0.09, 'square', 0.22);
      tone(1318, 0.14, 'square', 0.22, 0, 0.08);
    },
    blip() {
      tone(660, 0.07, 'sine', 0.25);
    },
    complete() {
      const seq = [523, 659, 784, 1046];
      for (let i = 0; i < seq.length; i += 1) tone(seq[i], 0.16, 'square', 0.22, 0, i * 0.1);
    },
    busted() {
      tone(392, 0.2, 'square', 0.25);
      tone(311, 0.34, 'square', 0.25, 0, 0.18);
    },
    /** Continuous voices, driven once per frame from the game loop. */
    update(dt, drivingSpeed, sirenLevel) {
      if (!enabled || !ctx) return;
      // Engine: a saw whose pitch follows the driven car's speed.
      if (drivingSpeed !== null) {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineGain = ctx.createGain();
          engineOsc.type = 'sawtooth';
          engineGain.gain.value = 0.0;
          engineOsc.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        engineOsc.frequency.value = 55 + Math.abs(drivingSpeed) * 0.55;
        engineGain.gain.value = 0.05 + Math.min(0.08, Math.abs(drivingSpeed) / 3000);
      } else if (engineOsc) {
        engineGain.gain.value = 0;
      }
      // Siren: a two-tone wail that fades with distance.
      if (sirenLevel > 0.02) {
        if (!sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenGain = ctx.createGain();
          sirenOsc.type = 'triangle';
          sirenGain.gain.value = 0;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
        }
        sirenPhase += dt * 2.4;
        sirenOsc.frequency.value = 660 + Math.sin(sirenPhase * Math.PI * 2) * 190;
        sirenGain.gain.value = 0.05 * sirenLevel;
      } else if (sirenOsc) {
        sirenGain.gain.value = 0;
      }
      // Music sequencer: 8 steps a second.
      musicTimer -= dt;
      if (musicTimer <= 0) {
        musicTimer += 0.125;
        const step = musicStep % 16;
        musicStep += 1;
        if (BASS[step]) tone(BASS[step], 0.11, 'triangle', 0.16);
        if (step % 2 === 0 && KEYS[step]) tone(KEYS[step], 0.1, 'sine', 0.05);
      }
    },
  };
}
