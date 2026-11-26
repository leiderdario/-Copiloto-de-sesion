const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createBucket } = require('../src/utils/groq-stt');

const CAP = 86400; // refill = 1 per second
let dirs = [];
function tmpFile() {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bucket-test-'));
    dirs.push(d);
    return path.join(d, 'usage.json');
}
afterEach(() => {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
    dirs = [];
});

describe('createBucket', () => {
    test('starts full', () => {
        const b = createBucket(tmpFile(), CAP, () => 0);
        assert.equal(b.remaining(), CAP);
    });
    test('use lowers remaining', () => {
        const b = createBucket(tmpFile(), CAP, () => 0);
        b.use(100);
        assert.equal(b.remaining(), CAP - 100);
    });
    test('refills capacity/86400 per second', () => {
        let t = 0;
        const b = createBucket(tmpFile(), CAP, () => t);
        b.use(1000);
        t += 10000;
        assert.ok(Math.abs(b.remaining() - (CAP - 1000 + 10)) < 1e-6);
    });
    test('refill rate scales with capacity (28800 -> 1/3 per s)', () => {
        let t = 0;
        const b = createBucket(tmpFile(), 28800, () => t);
        b.use(100);
        t += 43200; // 43.2 s
        assert.ok(Math.abs(b.remaining() - (28800 - 100 + 14.4)) < 1e-6);
    });
    test('never exceeds capacity', () => {
        let t = 0;
        const b = createBucket(tmpFile(), CAP, () => t);
        b.use(5);
        t += 10 * 86400000;
        assert.equal(b.remaining(), CAP);
    });
    test('never below zero', () => {
        const b = createBucket(tmpFile(), CAP, () => 0);
        b.use(CAP * 2);
        assert.equal(b.remaining(), 0);
    });
    test('persisted state reloads in a new bucket', () => {
        const f = tmpFile();
        let t = 5000;
        const a = createBucket(f, CAP, () => t);
        a.use(500);
        const b = createBucket(f, CAP, () => t);
        assert.equal(b.remaining(), CAP - 500);
        t += 20000;
        const c = createBucket(f, CAP, () => t);
        assert.ok(Math.abs(c.remaining() - (CAP - 500 + 20)) < 1e-6);
    });
    test('corrupt file falls back to full', () => {
        const f = tmpFile();
        fs.writeFileSync(f, 'not json');
        assert.equal(createBucket(f, CAP, () => 0).remaining(), CAP);
    });
});
