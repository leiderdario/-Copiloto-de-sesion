const test = require('node:test');
const assert = require('node:assert/strict');
const { createSegmenter, resample, toWav, isHallucination, rmsOf, DEFAULTS, IN_RATE, OUT_RATE } = require('../src/utils/groq-stt');

const FRAME_SAMPLES = (IN_RATE * 30) / 1000; // 720
const CHUNK = IN_RATE / 10; // 100 ms = 2400 samples

// ---------- Generadores de señal sintética (24 kHz) ----------

function silence(sec) {
    return new Int16Array(Math.round(sec * IN_RATE));
}

function noise(sec, amp) {
    const out = new Int16Array(Math.round(sec * IN_RATE));
    // pseudo-aleatorio determinista (LCG) para que el test sea reproducible
    let s = 12345;
    for (let i = 0; i < out.length; i++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        out[i] = Math.round(((s / 0xffffffff) * 2 - 1) * amp);
    }
    return out;
}

// "Voz": seno 300 Hz con modulación de amplitud lenta (0.7..1.0).
function speech(sec, amp = 6000, freq = 300) {
    const n = Math.round(sec * IN_RATE);
    const out = new Int16Array(n);
    for (let i = 0; i < n; i++) {
        const t = i / IN_RATE;
        const env = 0.85 + 0.15 * Math.sin(2 * Math.PI * 3 * t);
        out[i] = Math.round(amp * env * Math.sin(2 * Math.PI * freq * t));
    }
    return out;
}

function cat(...parts) {
    const len = parts.reduce((a, p) => a + p.length, 0);
    const out = new Int16Array(len);
    let p = 0;
    for (const a of parts) {
        out.set(a, p);
        p += a.length;
    }
    return out;
}

// Alimenta el segmentador en trozos de 100 ms como la app real; devuelve segmentos y el flush final.
function run(signal, opts) {
    const seg = createSegmenter(opts);
    const segments = [];
    for (let i = 0; i < signal.length; i += CHUNK) {
        segments.push(...seg.push(signal.slice(i, i + CHUNK)));
    }
    return { segments, flushed: seg.flush() };
}

const ms = samples => (samples.length / IN_RATE) * 1000;

// ---------- Segmentador ----------

test('1. silencio puro 30 s: sin segmentos y flush() devuelve null', () => {
    for (const sig of [silence(30), noise(30, 30)]) {
        const { segments, flushed } = run(sig);
        assert.equal(segments.length, 0);
        assert.equal(flushed, null);
    }
});

test('2. 10 s de voz + 1 s de silencio: un segmento cortado en la pausa', () => {
    const { segments, flushed } = run(cat(noise(0.3, 30), speech(10), noise(1, 30)));
    assert.equal(segments.length, 1);
    assert.equal(flushed, null);
    const s = segments[0];
    assert.ok(Math.abs(s.speechMs - 10000) <= 100, `speechMs=${s.speechMs}`);
    const dur = ms(s.samples);
    // voz + preRoll (<= 300 ms) + cola (<= tailKeepMs + 1 frame)
    assert.ok(dur >= 10000, `dur=${dur}`);
    assert.ok(dur <= 10000 + DEFAULTS.preRollMs + DEFAULTS.tailKeepMs + 60, `dur=${dur}`);
});

test('3. 3 s de voz + 2 s de silencio: un segmento corto (flushSilenceMs)', () => {
    const { segments, flushed } = run(cat(speech(3), noise(2, 30)));
    assert.equal(segments.length, 1);
    assert.equal(flushed, null);
    assert.ok(Math.abs(segments[0].speechMs - 3000) <= 100, `speechMs=${segments[0].speechMs}`);
    const dur = ms(segments[0].samples);
    assert.ok(dur >= 3000 && dur <= 3000 + DEFAULTS.tailKeepMs + 60, `dur=${dur}`);
});

test('4. pausas de 0,8 s no cortan mientras el segmento < 8 s', () => {
    const sig = cat(speech(3), noise(0.8, 30), speech(3), noise(0.8, 30), speech(3), noise(2, 30));
    const { segments, flushed } = run(sig);
    assert.equal(flushed, null);
    assert.equal(segments.length, 1, `segmentos=${segments.length}`);
    assert.ok(Math.abs(segments[0].speechMs - 9000) <= 150, `speechMs=${segments[0].speechMs}`);
    // incluye las pausas internas: >= 9 + 1.6 s
    assert.ok(ms(segments[0].samples) >= 10600);
    for (const s of segments) {
        assert.ok(s.samples.length <= (DEFAULTS.maxSegmentMs / 1000) * IN_RATE + FRAME_SAMPLES);
    }
});

test('5. 45 s de voz continua: segmentos <= 20 s y al menos 2', () => {
    const { segments, flushed } = run(speech(45));
    const all = flushed ? [...segments, flushed] : segments;
    assert.ok(all.length >= 2, `segmentos=${all.length}`);
    const max = (DEFAULTS.maxSegmentMs / 1000) * IN_RATE + FRAME_SAMPLES;
    for (const s of all) {
        assert.ok(s.samples.length <= max, `len=${s.samples.length}`);
    }
});

test('6. un click de 60 ms seguido de silencio: sin segmento (minSpeechMs)', () => {
    const { segments, flushed } = run(cat(noise(1, 30), speech(0.06), noise(3, 30)));
    assert.equal(segments.length, 0);
    assert.equal(flushed, null);
});

test('7. ruido de fondo constante (~200) durante 10 s: sin segmentos', () => {
    const { segments, flushed } = run(noise(10, 200));
    assert.equal(segments.length, 0);
    assert.equal(flushed, null);
});

test('reset() descarta el segmento en curso', () => {
    const seg = createSegmenter();
    seg.push(speech(2));
    seg.reset();
    assert.equal(seg.flush(), null);
});

// ---------- resample ----------

test('8. resample: 24000 muestras -> 16000', () => {
    assert.equal(resample(new Int16Array(24000)).length, 16000);
});

test('8. resample: señal constante se mantiene constante', () => {
    const out = resample(new Int16Array(24000).fill(1234));
    assert.ok(out.every(v => v === 1234));
});

test('8. resample: seno de 440 Hz conserva el RMS (±5%)', () => {
    const n = 24000;
    const input = new Int16Array(n);
    for (let i = 0; i < n; i++) input[i] = Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / IN_RATE));
    const out = resample(input);
    const rin = rmsOf(input, 0, input.length);
    const rout = rmsOf(out, 0, out.length);
    assert.ok(Math.abs(rout - rin) / rin <= 0.05, `rin=${rin} rout=${rout}`);
});

test('resample: misma frecuencia devuelve copia', () => {
    const a = Int16Array.from([1, 2, 3]);
    const b = resample(a, 16000, 16000);
    assert.deepEqual(Array.from(b), [1, 2, 3]);
    assert.notEqual(b, a);
});

// ---------- toWav ----------

test('9. toWav: cabecera y longitud', () => {
    const samples = Int16Array.from([0, 1000, -1000, 32767, -32768]);
    const wav = toWav(samples);
    assert.equal(wav.length, 44 + 2 * samples.length);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt32LE(4), 36 + 2 * samples.length);
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.toString('ascii', 12, 16), 'fmt ');
    assert.equal(wav.readUInt32LE(16), 16);
    assert.equal(wav.readUInt16LE(20), 1); // PCM
    assert.equal(wav.readUInt16LE(22), 1); // mono
    assert.equal(wav.readUInt32LE(24), OUT_RATE);
    assert.equal(wav.readUInt32LE(24), 16000);
    assert.equal(wav.readUInt32LE(28), 32000);
    assert.equal(wav.readUInt16LE(32), 2);
    assert.equal(wav.readUInt16LE(34), 16);
    assert.equal(wav.toString('ascii', 36, 40), 'data');
    assert.equal(wav.readUInt32LE(40), 2 * samples.length);
    for (let i = 0; i < samples.length; i++) assert.equal(wav.readInt16LE(44 + 2 * i), samples[i]);
});

// ---------- isHallucination ----------

test('10. isHallucination', () => {
    for (const t of ['Gracias.', ' gracias ', '', 'Thank you.', null, undefined]) {
        assert.equal(isHallucination(t), true, JSON.stringify(t));
    }
    assert.equal(isHallucination('¿Cómo hago un JOIN en MySQL?'), false);
});
