// question-engine.js — Detecta preguntas en la transcripción y las responde (Fase 2).
//
// Por cada segmento transcrito: prefiltro local barato → si es candidato, UNA llamada
// a Groq en modo JSON → si es pregunta y no es repetida, emite una tarjeta.
// Todo en memoria (F6).

const { questionPrompt } = require('./prompts-copiloto');

const CONTEXT_MS = 120000; // transcripción reciente que se manda como contexto
const DEDUPE_MS = 60000;

const INTERROGATIVES = [
    // español (sin tildes: se normaliza antes)
    'como',
    'que',
    'por que',
    'porque',
    'cual',
    'cuales',
    'cuanto',
    'cuantos',
    'cuanta',
    'donde',
    'cuando',
    'quien',
    'puedes',
    'podrias',
    'podria',
    'se puede',
    'hay alguna',
    'hay forma',
    'es posible',
    'me explicas',
    'explicame',
    'tengo una duda',
    'una pregunta',
    'no entiendo',
    // inglés
    'how',
    'what',
    'why',
    'which',
    'where',
    'when',
    'who',
    'can you',
    'could you',
    'would you',
    'is it',
    'is there',
    'do you',
    'does it',
    'should i',
    'should we',
];

function normalize(text) {
    return (text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9ñ?¿\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ¿Merece la pena preguntar al LLM? (barato, local)
// - Con "?" o "¿" siempre.
// - Las expresiones de varias palabras ("tengo una duda", "can you") en cualquier sitio.
// - Las palabras sueltas ("que", "como", "how") solo al inicio de una frase o tras "profe,",
//   porque en medio de una frase casi nunca preguntan ("la tabla que tiene…").
function isCandidate(text) {
    if (!text) return false;
    if (/[?¿]/.test(text)) return true;
    const n = ' ' + normalize(text) + ' ';
    if (INTERROGATIVES.some(w => w.includes(' ') && n.includes(' ' + w + ' '))) return true;
    const clauses = (text || '')
        .split(/[.!;:\n]|,\s*(?=profe|profesor|oye|disculpa|perdona|una pregunta)/i)
        .map(c => normalize(c).replace(/^(profe|profesor|oye|disculpa|perdona|y|entonces|pero|bueno)\s+/, ''));
    return clauses.some(c => INTERROGATIVES.some(w => !w.includes(' ') && (c === w || c.startsWith(w + ' '))));
}

function sameQuestion(a, b) {
    const x = normalize(a).replace(/[?¿]/g, '').trim();
    const y = normalize(b).replace(/[?¿]/g, '').trim();
    if (!x || !y) return false;
    if (x === y || x.includes(y) || y.includes(x)) return true;
    // Similitud por palabras (Jaccard)
    const sx = new Set(x.split(' ').filter(w => w.length > 2));
    const sy = new Set(y.split(' ').filter(w => w.length > 2));
    if (!sx.size || !sy.size) return false;
    let inter = 0;
    for (const w of sx) if (sy.has(w)) inter++;
    return inter / (sx.size + sy.size - inter) >= 0.7;
}

function parseJsonLoose(text) {
    try {
        return JSON.parse(text);
    } catch (_) {
        const m = /\{[\s\S]*\}/.exec(text || '');
        if (m) {
            try {
                return JSON.parse(m[0]);
            } catch (_) {}
        }
    }
    return null;
}

function createQuestionEngine({ callLlm, getLanguage, onCard, onCardUpdate, onNotice, now = () => Date.now() }) {
    let recent = []; // {at, text}
    let asked = []; // {at, pregunta}
    let cardId = 0;
    const queue = [];
    let busy = false;

    function clear() {
        recent = [];
        asked = [];
        queue.length = 0;
    }

    function addSegment(seg) {
        const at = seg.at || now();
        recent.push({ at, text: seg.text });
        recent = recent.filter(r => now() - r.at <= CONTEXT_MS);
        if (!isCandidate(seg.text)) return false;
        if (queue.length >= 3) queue.shift(); // si Groq va lento, prioriza lo último
        queue.push({ text: seg.text, at });
        drain();
        return true;
    }

    async function drain() {
        if (busy) return;
        busy = true;
        while (queue.length) {
            await analyze(queue.shift());
        }
        busy = false;
    }

    async function analyze(item) {
        const lang = getLanguage();
        const context = recent
            .filter(r => r.at < item.at)
            .map(r => r.text)
            .join(' ')
            .slice(-2500);
        const messages = [
            { role: 'system', content: questionPrompt(lang) },
            { role: 'user', content: `Transcripción reciente:\n${context || '(vacía)'}\n\nÚLTIMO fragmento:\n${item.text}` },
        ];
        let result;
        try {
            result = parseJsonLoose(await callLlm(messages));
        } catch (err) {
            if (onNotice) onNotice(`No se pudo analizar una posible pregunta: ${err.message}`);
            return;
        }
        if (!result || !result.es_pregunta || !result.pregunta) return;

        asked = asked.filter(a => now() - a.at <= DEDUPE_MS);
        if (asked.some(a => sameQuestion(a.pregunta, result.pregunta))) return;
        asked.push({ at: now(), pregunta: result.pregunta });

        onCard({
            id: ++cardId,
            tipo: 'pregunta',
            at: item.at,
            pregunta: String(result.pregunta),
            pregunta_es: result.pregunta_es ? String(result.pregunta_es) : null,
            respuesta_corta: String(result.respuesta_corta || ''),
            detalle: String(result.detalle || ''),
            estado: 'lista',
        });
    }

    return { addSegment, clear };
}

module.exports = { createQuestionEngine, isCandidate, sameQuestion, normalize, parseJsonLoose };
