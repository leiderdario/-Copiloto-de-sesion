const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createQuestionEngine, isCandidate, sameQuestion, parseJsonLoose } = require('../src/utils/question-engine');

describe('isCandidate', () => {
    for (const t of ['¿Cómo hago un JOIN?', 'Profe tengo una duda con la fórmula', 'how do I pivot this table', 'Qué diferencia hay entre WHERE y HAVING']) {
        test(`true: ${t}`, () => assert.equal(isCandidate(t), true));
    }
    for (const t of ['Bueno seguimos con la siguiente diapositiva', 'Perfecto, gracias a todos', '']) {
        test(`false: "${t}"`, () => assert.equal(isCandidate(t), false));
    }
});

describe('sameQuestion', () => {
    test('same modulo case, accents and punctuation', () => {
        assert.equal(sameQuestion('¿Cuál es la diferencia entre LEFT JOIN e INNER JOIN?', 'cual es la diferencia entre left join e inner join'), true);
    });
    test('containment', () => {
        assert.equal(sameQuestion('diferencia entre left join e inner join', 'Cuál es la diferencia entre left join e inner join y cuándo uso cada uno'), true);
    });
    test('unrelated', () => {
        assert.equal(sameQuestion('¿Cómo hago un JOIN?', '¿Dónde se entrega el trabajo final?'), false);
    });
});

describe('parseJsonLoose', () => {
    test('plain JSON', () => assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 }));
    test('wrapped in prose', () => assert.deepEqual(parseJsonLoose('Aquí tienes: {"a":1} espero ayude'), { a: 1 }));
    test('json fences', () => assert.deepEqual(parseJsonLoose('```json\n{"a":{"b":2}}\n```'), { a: { b: 2 } }));
    test('garbage -> null', () => {
        assert.equal(parseJsonLoose('nada de json'), null);
        assert.equal(parseJsonLoose('{roto'), null);
        assert.equal(parseJsonLoose(''), null);
        assert.equal(parseJsonLoose(undefined), null);
    });
});

async function settle(spy) {
    let last = -1;
    for (let i = 0; i < 50; i++) {
        await new Promise(r => setImmediate(r));
        if (spy.calls === last && i > 3) return;
        last = spy.calls;
    }
}

function setup(responder) {
    let t = 1000000;
    const spy = { calls: 0, messages: [] };
    const cards = [];
    const notices = [];
    const engine = createQuestionEngine({
        callLlm: async messages => {
            spy.calls++;
            spy.messages.push(messages);
            return responder(messages, spy.calls);
        },
        getLanguage: () => 'es',
        onCard: c => cards.push(c),
        onNotice: n => notices.push(n),
        now: () => t,
    });
    return { engine, spy, cards, notices, advance: ms => (t += ms) };
}

const Q = '¿Cuál es la diferencia entre LEFT JOIN e INNER JOIN?';
const YES = JSON.stringify({ es_pregunta: true, pregunta: Q, respuesta_corta: 'LEFT conserva todas las filas de la izquierda', detalle: 'INNER solo coincidencias' });

describe('createQuestionEngine', () => {
    test('non-candidate never calls LLM', async () => {
        const { engine, spy, cards } = setup(() => YES);
        assert.equal(engine.addSegment({ text: 'Bueno seguimos con la siguiente diapositiva' }), false);
        await settle(spy);
        assert.equal(spy.calls, 0);
        assert.equal(cards.length, 0);
    });

    test('candidate with es_pregunta:true emits one card', async () => {
        const { engine, spy, cards } = setup(() => YES);
        engine.addSegment({ text: Q });
        await settle(spy);
        assert.equal(spy.calls, 1);
        assert.equal(cards.length, 1);
        assert.equal(cards[0].id, 1);
        assert.equal(cards[0].tipo, 'pregunta');
        assert.equal(cards[0].pregunta, Q);
        assert.equal(cards[0].respuesta_corta, 'LEFT conserva todas las filas de la izquierda');
        assert.equal(cards[0].detalle, 'INNER solo coincidencias');
    });

    test('es_pregunta:false -> no card', async () => {
        const { engine, spy, cards } = setup(() => JSON.stringify({ es_pregunta: false }));
        engine.addSegment({ text: Q });
        await settle(spy);
        assert.equal(spy.calls, 1);
        assert.equal(cards.length, 0);
    });

    test('dedupe within 60s, new card after', async () => {
        const { engine, spy, cards, advance } = setup(() => YES);
        engine.addSegment({ text: Q });
        await settle(spy);
        advance(10000);
        engine.addSegment({ text: Q });
        await settle(spy);
        assert.equal(spy.calls, 2);
        assert.equal(cards.length, 1);
        advance(61000);
        engine.addSegment({ text: Q });
        await settle(spy);
        assert.equal(cards.length, 2);
        assert.equal(cards[1].id, 2);
    });

    test('callLlm throwing -> notice, no card, engine keeps working', async () => {
        const { engine, spy, cards, notices, advance } = setup((m, n) => {
            if (n === 1) throw new Error('boom');
            return YES;
        });
        engine.addSegment({ text: Q });
        await settle(spy);
        assert.equal(notices.length, 1);
        assert.match(notices[0], /boom/);
        assert.equal(cards.length, 0);
        advance(1000);
        engine.addSegment({ text: Q });
        await settle(spy);
        assert.equal(cards.length, 1);
    });

    test('clear() empties dedupe memory', async () => {
        const { engine, spy, cards, advance } = setup(() => YES);
        engine.addSegment({ text: Q });
        await settle(spy);
        engine.clear();
        advance(1000);
        engine.addSegment({ text: Q });
        await settle(spy);
        assert.equal(cards.length, 2);
    });

    test('messages include previous segments as context', async () => {
        const { engine, spy, advance } = setup(() => JSON.stringify({ es_pregunta: false }));
        engine.addSegment({ text: 'Hoy vemos bases de datos relacionales' });
        advance(1000);
        engine.addSegment({ text: 'Primero las tablas y sus claves' });
        advance(1000);
        engine.addSegment({ text: '¿Cómo hago un JOIN?' });
        await settle(spy);
        assert.equal(spy.calls, 1);
        const [sys, user] = spy.messages[0];
        assert.equal(sys.role, 'system');
        assert.equal(user.role, 'user');
        assert.ok(user.content.includes('ÚLTIMO fragmento'));
        assert.ok(user.content.includes('¿Cómo hago un JOIN?'));
        assert.ok(user.content.includes('Hoy vemos bases de datos relacionales'));
        assert.ok(user.content.includes('Primero las tablas y sus claves'));
    });
});

// Regresión: las palabras interrogativas sueltas solo cuentan al inicio de una frase.
test('isCandidate: palabras sueltas solo al inicio de frase', () => {
    const cases = [
        ['Primero vamos a ver la tabla de ventas que tiene fecha, región y total.', false],
        ['Bueno, sigamos con la siguiente diapositiva.', false],
        ['Buenas tardes a todos, hoy vamos a repasar consultas en MySQL.', false],
        ['that is what I said', false],
        ['Profe, cómo saco el total por región', true],
        ['Y cómo lo filtro por año', true],
    ];
    for (const [text, expected] of cases) assert.equal(isCandidate(text), expected, text);
});
