// groq-stt.js — Transcripción del audio del sistema con Groq Whisper (Fase 1).
//
// Entrada: PCM16 mono a 24 kHz en trozos (~100 ms) desde el renderer.
// 1. VAD por energía con suelo de ruido adaptativo.
// 2. Segmentos de 8–20 s cortados en pausas ≥ 0,7 s (o antes si el silencio dura ≥ 1,5 s).
// 3. Se descartan los segmentos sin voz suficiente; se recorta el silencio final.
// 4. Remuestreo a 16 kHz → WAV → POST /openai/v1/audio/transcriptions.
// Nada se guarda en disco salvo un contador diario de segundos (sin contenido).

const fs = require('fs');
const path = require('path');

const IN_RATE = 24000;
const OUT_RATE = 16000;
const FRAME_MS = 30;

const DEFAULTS = {
    model: 'whisper-large-v3-turbo',
    language: 'es',
    prompt: '',
    minSegmentMs: 8000,
    maxSegmentMs: 20000,
    pauseMs: 700, // pausa que corta un segmento que ya tiene ≥ minSegmentMs
    flushSilenceMs: 1500, // silencio que corta aunque el segmento sea corto
    preRollMs: 300,
    tailKeepMs: 300,
    minSpeechMs: 400, // voz mínima para enviar un segmento
    minRms: 0.008, // umbral absoluto (escala -1..1)
    noiseFactor: 3,
    maxRetries: 3,
    dailyAudioLimitSec: 28800,
    hourlyAudioLimitSec: 7200,
    dailyRequestLimit: 2000,
};

// Frases que Whisper suele inventar sobre silencio o música.
const HALLUCINATIONS = [
    'gracias.',
    'gracias',
    '¡gracias!',
    'muchas gracias.',
    'gracias por ver el video.',
    'gracias por ver.',
    'subtítulos realizados por la comunidad de amara.org',
    'subtítulos por la comunidad de amara.org',
    '¡suscríbete!',
    'thank you.',
    'thanks for watching!',
    'thank you for watching.',
    'you',
    '.',
];

// ---------- Utilidades puras (probadas en tests) ----------

function rmsOf(samples, start, end) {
    let sum = 0;
    for (let i = start; i < end; i++) {
        const v = samples[i] / 32768;
        sum += v * v;
    }
    return Math.sqrt(sum / Math.max(1, end - start));
}

// Remuestreo lineal 24 kHz → 16 kHz (Int16Array → Int16Array).
function resample(input, inRate = IN_RATE, outRate = OUT_RATE) {
    if (inRate === outRate) return Int16Array.from(input);
    const outLen = Math.floor((input.length * outRate) / inRate);
    const out = new Int16Array(outLen);
    const ratio = inRate / outRate;
    for (let i = 0; i < outLen; i++) {
        const pos = i * ratio;
        const i0 = Math.floor(pos);
        const i1 = Math.min(i0 + 1, input.length - 1);
        const frac = pos - i0;
        out[i] = Math.round(input[i0] * (1 - frac) + input[i1] * frac);
    }
    return out;
}

function toWav(int16, sampleRate = OUT_RATE) {
    const data = Buffer.from(int16.buffer, int16.byteOffset, int16.byteLength);
    const h = Buffer.alloc(44);
    h.write('RIFF', 0);
    h.writeUInt32LE(36 + data.length, 4);
    h.write('WAVE', 8);
    h.write('fmt ', 12);
    h.writeUInt32LE(16, 16);
    h.writeUInt16LE(1, 20); // PCM
    h.writeUInt16LE(1, 22); // mono
    h.writeUInt32LE(sampleRate, 24);
    h.writeUInt32LE(sampleRate * 2, 28);
    h.writeUInt16LE(2, 32);
    h.writeUInt16LE(16, 34);
    h.write('data', 36);
    h.writeUInt32LE(data.length, 40);
    return Buffer.concat([h, data]);
}

function isHallucination(text) {
    const t = (text || '').trim().toLowerCase();
    return t.length === 0 || HALLUCINATIONS.includes(t);
}

// Segmentador: recibe Int16Array a 24 kHz y devuelve los segmentos cerrados.
function createSegmenter(opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    const frameLen = Math.round((IN_RATE * FRAME_MS) / 1000);
    const preRollFrames = Math.ceil(o.preRollMs / FRAME_MS);

    let pending = new Int16Array(0); // muestras que aún no forman un frame
    let preRoll = []; // últimos frames antes de que empiece la voz
    let frames = null; // frames del segmento en curso (null = no hay segmento)
    let speechMs = 0;
    let silenceMs = 0;
    let noiseFloor = o.minRms / o.noiseFactor;

    function closeSegment() {
        // Recorta el silencio final dejando tailKeepMs.
        const dropFrames = Math.max(0, Math.floor((silenceMs - o.tailKeepMs) / FRAME_MS));
        const kept = frames.slice(0, Math.max(0, frames.length - dropFrames));
        const result = { speechMs, samples: concat(kept) };
        frames = null;
        speechMs = 0;
        silenceMs = 0;
        return result.speechMs >= o.minSpeechMs ? result : null;
    }

    function push(chunk) {
        const out = [];
        const all = concat([pending, chunk]);
        let offset = 0;
        while (offset + frameLen <= all.length) {
            const frame = all.subarray(offset, offset + frameLen);
            offset += frameLen;
            const rms = rmsOf(frame, 0, frame.length);
            const isSpeech = rms > Math.max(o.minRms, noiseFloor * o.noiseFactor);
            if (!isSpeech) noiseFloor = noiseFloor * 0.98 + rms * 0.02;

            if (frames === null) {
                preRoll.push(frame);
                if (preRoll.length > preRollFrames) preRoll.shift();
                if (isSpeech) {
                    frames = preRoll.slice();
                    preRoll = [];
                    speechMs = FRAME_MS;
                    silenceMs = 0;
                }
                continue;
            }

            frames.push(frame);
            if (isSpeech) {
                speechMs += FRAME_MS;
                silenceMs = 0;
            } else {
                silenceMs += FRAME_MS;
            }
            const durMs = frames.length * FRAME_MS;
            const cutAtPause = durMs >= o.minSegmentMs && silenceMs >= o.pauseMs;
            const cutLongSilence = silenceMs >= o.flushSilenceMs;
            const cutMax = durMs >= o.maxSegmentMs;
            if (cutAtPause || cutLongSilence || cutMax) {
                const seg = closeSegment();
                if (seg) out.push(seg);
            }
        }
        pending = Int16Array.from(all.subarray(offset));
        return out;
    }

    function flush() {
        if (frames === null) return null;
        return closeSegment();
    }

    function reset() {
        pending = new Int16Array(0);
        preRoll = [];
        frames = null;
        speechMs = 0;
        silenceMs = 0;
    }

    return { push, flush, reset };
}

function concat(arrays) {
    let len = 0;
    for (const a of arrays) len += a.length;
    const out = new Int16Array(len);
    let p = 0;
    for (const a of arrays) {
        out.set(a, p);
        p += a.length;
    }
    return out;
}

// ---------- Cupo diario estimado (solo números) ----------
// Groq recarga los límites de forma continua (cubeta): el cupo diario de audio se
// rellena a razón de capacidad/86 400 s por segundo, no de golpe a medianoche.
// Las cabeceras no informan del cupo diario de audio, así que se estima en local.

function createBucket(file, capacity, now = () => Date.now()) {
    const ratePerMs = capacity / 86400000;
    let state = { level: capacity, t: now() };
    try {
        const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (typeof saved.level === 'number' && typeof saved.t === 'number') state = saved;
    } catch (_) {}
    function refill() {
        const t = now();
        state = { level: Math.min(capacity, state.level + (t - state.t) * ratePerMs), t };
    }
    return {
        use(sec) {
            refill();
            state.level = Math.max(0, state.level - sec);
            try {
                fs.mkdirSync(path.dirname(file), { recursive: true });
                fs.writeFileSync(file, JSON.stringify(state));
            } catch (_) {}
        },
        remaining() {
            refill();
            return state.level;
        },
    };
}

// ---------- Motor ----------

function createGroqStt({ getApiKey, getOptions, usageFile, onSegment, onStatus, onUsage, fetchImpl = fetch }) {
    let segmenter = createSegmenter(getOptions());
    const dayBucket = createBucket(usageFile, getOptions().dailyAudioLimitSec);
    const queue = [];
    let busy = false;
    let active = false; // sesión iniciada
    let paused = false;
    let blockedUntil = 0; // límite de Groq: no enviar hasta esta hora
    let segId = 0;
    let lastHeaders = { remainingAudioHour: null, remainingRequestsDay: null };
    let sessionAudioMs = 0; // audio real recibido mientras escucha
    let sessionSentSec = 0; // audio enviado (facturable)

    function status(state, message = '') {
        onStatus({ state, message, paused, blockedUntil });
    }

    function usage() {
        const o = getOptions();
        onUsage({
            at: Date.now(),
            dayRemainingAudioSec: dayBucket.remaining(),
            dayAudioLimitSec: o.dailyAudioLimitSec,
            dayRequestLimit: o.dailyRequestLimit,
            hourRemainingAudioSec: lastHeaders.remainingAudioHour,
            hourAudioLimitSec: o.hourlyAudioLimitSec,
            remainingRequestsDay: lastHeaders.remainingRequestsDay,
            sessionAudioSec: sessionAudioMs / 1000,
            sessionSentSec,
        });
    }

    function start() {
        segmenter = createSegmenter(getOptions());
        active = true;
        paused = false;
        sessionAudioMs = 0;
        sessionSentSec = 0;
        status('listening');
        usage();
    }

    function stop() {
        active = false;
        queue.length = 0;
        segmenter.reset();
        status('stopped');
    }

    function setPaused(value) {
        paused = !!value;
        if (paused) {
            segmenter.reset(); // lo que estaba a medias no se envía
            status('paused');
        } else {
            status(Date.now() < blockedUntil ? 'limited' : 'listening');
        }
        return paused;
    }

    function pushPcm(buffer) {
        if (!active || paused) return;
        const samples = new Int16Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.byteLength / 2));
        sessionAudioMs += (samples.length / IN_RATE) * 1000;
        if (Date.now() < blockedUntil) return; // en espera por límite: se descarta
        for (const seg of segmenter.push(Int16Array.from(samples))) enqueue(seg);
    }

    function enqueue(seg) {
        if (queue.length >= 5) {
            queue.shift();
            onStatus({ state: 'warning', message: 'Se descartó un fragmento: Groq va más lento que el audio', paused, blockedUntil });
        }
        queue.push({ ...seg, id: ++segId, at: Date.now() });
        drain();
    }

    async function drain() {
        if (busy) return;
        busy = true;
        while (queue.length && active) {
            const seg = queue.shift();
            await transcribe(seg);
        }
        busy = false;
    }

    function parseReset(v) {
        // Formatos de Groq: "1s", "43.2s", "2m59.5s", "1h2m3s"
        if (!v) return 0;
        let ms = 0;
        const re = /(\d+(?:\.\d+)?)(ms|h|m|s)/g;
        let m;
        while ((m = re.exec(v))) {
            const n = parseFloat(m[1]);
            ms += m[2] === 'h' ? n * 3600000 : m[2] === 'm' ? n * 60000 : m[2] === 's' ? n * 1000 : n;
        }
        return ms;
    }

    async function transcribe(seg) {
        const o = getOptions();
        const key = getApiKey();
        if (!key) {
            onStatus({ state: 'error', message: 'Falta la clave de Groq', paused, blockedUntil });
            return;
        }
        const pcm16k = resample(seg.samples);
        const wav = toWav(pcm16k);
        const durSec = pcm16k.length / OUT_RATE;

        for (let attempt = 1; attempt <= o.maxRetries; attempt++) {
            const t0 = Date.now();
            try {
                const fd = new FormData();
                fd.append('file', new Blob([wav], { type: 'audio/wav' }), 'audio.wav');
                fd.append('model', o.model);
                if (o.language) fd.append('language', o.language);
                if (o.prompt) fd.append('prompt', o.prompt.slice(0, 800));
                fd.append('response_format', 'verbose_json');
                fd.append('temperature', '0');

                const res = await fetchImpl('https://api.groq.com/openai/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${key}` },
                    body: fd,
                });

                const ra = res.headers.get('x-ratelimit-remaining-audio-seconds');
                const rr = res.headers.get('x-ratelimit-remaining-requests');
                if (ra !== null) lastHeaders.remainingAudioHour = Number(ra);
                if (rr !== null) lastHeaders.remainingRequestsDay = Number(rr);

                if (res.status === 429) {
                    const retryAfterSec = Number(res.headers.get('retry-after')) || 0;
                    const waitMs = Math.max(retryAfterSec * 1000, parseReset(res.headers.get('x-ratelimit-reset-audio-seconds')), 60000);
                    blockedUntil = Date.now() + waitMs;
                    onStatus({
                        state: 'limited',
                        message: `Límite de Groq alcanzado. La escucha se reanuda sola en ${Math.ceil(waitMs / 60000)} min`,
                        paused,
                        blockedUntil,
                    });
                    queue.length = 0;
                    usage();
                    setTimeout(() => {
                        if (active && !paused && Date.now() >= blockedUntil) status('listening');
                    }, waitMs + 50);
                    return;
                }

                if (!res.ok) {
                    const body = await res.text();
                    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
                }

                const json = await res.json();
                const latencyMs = Date.now() - t0;
                dayBucket.use(durSec); // medido: la cabecera horaria descuenta la duración real, sin mínimo de 10 s
                sessionSentSec += durSec;

                // Descarta segmentos que Whisper considera sin voz.
                const segs = Array.isArray(json.segments) ? json.segments : [];
                const text = segs.length
                    ? segs
                          .filter(s => !(s.no_speech_prob > 0.6 && s.avg_logprob < -1))
                          .map(s => s.text)
                          .join('')
                          .trim()
                    : (json.text || '').trim();

                console.log(
                    `[stt] #${seg.id} ${durSec.toFixed(1)}s voz=${(seg.speechMs / 1000).toFixed(1)}s latencia=${latencyMs}ms` +
                        ` enviado=${sessionSentSec.toFixed(0)}s real=${(sessionAudioMs / 1000).toFixed(0)}s`
                );

                if (!isHallucination(text)) {
                    onSegment({ id: seg.id, text, durationSec: durSec, latencyMs, at: seg.at });
                }
                if (!paused && Date.now() >= blockedUntil) status('listening');
                usage();
                return;
            } catch (err) {
                console.error(`[stt] intento ${attempt}/${o.maxRetries} falló:`, err.message);
                if (attempt < o.maxRetries) {
                    await new Promise(r => setTimeout(r, 1000 * 2 ** (attempt - 1)));
                } else {
                    onStatus({ state: 'warning', message: `No se pudo transcribir un fragmento: ${err.message}`, paused, blockedUntil });
                }
            }
        }
    }

    return { start, stop, setPaused, pushPcm, isPaused: () => paused, emitUsage: usage };
}

module.exports = {
    createGroqStt,
    createBucket,
    createSegmenter,
    resample,
    toWav,
    isHallucination,
    rmsOf,
    DEFAULTS,
    IN_RATE,
    OUT_RATE,
};
