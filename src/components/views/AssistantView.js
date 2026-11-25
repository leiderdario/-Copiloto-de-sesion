import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class AssistantView extends LitElement {
    static styles = css`
        :host {
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        * {
            font-family: var(--font);
            cursor: default;
        }

        /* ── Response area ── */

        .response-container {
            flex: 1;
            overflow-y: auto;
            font-size: var(--response-font-size, 15px);
            line-height: var(--line-height);
            background: var(--bg-app);
            padding: var(--space-sm) var(--space-md);
            scroll-behavior: smooth;
            user-select: text;
            cursor: text;
            color: var(--text-primary);
        }

        .response-container * {
            user-select: text;
            cursor: text;
        }

        .response-container a {
            cursor: pointer;
        }

        .response-container [data-word] {
            display: inline-block;
        }

        /* ── Markdown ── */

        .response-container h1,
        .response-container h2,
        .response-container h3,
        .response-container h4,
        .response-container h5,
        .response-container h6 {
            margin: 1em 0 0.5em 0;
            color: var(--text-primary);
            font-weight: var(--font-weight-semibold);
        }

        .response-container h1 { font-size: 1.5em; }
        .response-container h2 { font-size: 1.3em; }
        .response-container h3 { font-size: 1.15em; }
        .response-container h4 { font-size: 1.05em; }
        .response-container h5,
        .response-container h6 { font-size: 1em; }

        .response-container p {
            margin: 0.6em 0;
            color: var(--text-primary);
        }

        .response-container ul,
        .response-container ol {
            margin: 0.6em 0;
            padding-left: 1.5em;
            color: var(--text-primary);
        }

        .response-container li {
            margin: 0.3em 0;
        }

        .response-container blockquote {
            margin: 0.8em 0;
            padding: 0.5em 1em;
            border-left: 2px solid var(--border-strong);
            background: var(--bg-surface);
            border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
        }

        .response-container code {
            background: var(--bg-elevated);
            padding: 0.15em 0.4em;
            border-radius: var(--radius-sm);
            font-family: var(--font-mono);
            font-size: 0.85em;
        }

        .response-container pre {
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: var(--space-md);
            overflow-x: auto;
            margin: 0.8em 0;
        }

        .response-container pre code {
            background: none;
            padding: 0;
        }

        .response-container a {
            color: var(--accent);
            text-decoration: underline;
            text-underline-offset: 2px;
        }

        .response-container strong,
        .response-container b {
            font-weight: var(--font-weight-semibold);
        }

        .response-container hr {
            border: none;
            border-top: 1px solid var(--border);
            margin: 1.5em 0;
        }

        .response-container table {
            border-collapse: collapse;
            width: 100%;
            margin: 0.8em 0;
        }

        .response-container th,
        .response-container td {
            border: 1px solid var(--border);
            padding: var(--space-sm);
            text-align: left;
        }

        .response-container th {
            background: var(--bg-surface);
            font-weight: var(--font-weight-semibold);
        }

        .response-container::-webkit-scrollbar {
            width: 6px;
        }

        .response-container::-webkit-scrollbar-track {
            background: transparent;
        }

        .response-container::-webkit-scrollbar-thumb {
            background: var(--border-strong);
            border-radius: 3px;
        }

        .response-container::-webkit-scrollbar-thumb:hover {
            background: #444444;
        }

        /* ── Response navigation strip ── */

        .response-nav {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--space-sm);
            padding: var(--space-xs) var(--space-md);
            border-top: 1px solid var(--border);
            background: var(--bg-app);
        }

        .nav-btn {
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: var(--space-xs);
            border-radius: var(--radius-sm);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color var(--transition);
        }

        .nav-btn:hover:not(:disabled) {
            color: var(--text-primary);
        }

        .nav-btn:disabled {
            opacity: 0.25;
            cursor: default;
        }

        .nav-btn svg {
            width: 14px;
            height: 14px;
        }

        .response-counter {
            font-size: var(--font-size-xs);
            color: var(--text-muted);
            font-family: var(--font-mono);
            min-width: 40px;
            text-align: center;
        }

        /* ── Bottom input bar ── */

        .input-bar {
            display: flex;
            align-items: center;
            gap: var(--space-sm);
            padding: var(--space-md);
            background: var(--bg-app);
        }

        .input-bar-inner {
            display: flex;
            align-items: center;
            flex: 1;
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            border-radius: 100px;
            padding: 0 var(--space-md);
            height: 32px;
            transition: border-color var(--transition);
        }

        .input-bar-inner:focus-within {
            border-color: var(--accent);
        }

        .input-bar-inner input {
            flex: 1;
            background: none;
            color: var(--text-primary);
            border: none;
            padding: 0;
            font-size: var(--font-size-sm);
            font-family: var(--font);
            height: 100%;
            outline: none;
        }

        .input-bar-inner input::placeholder {
            color: var(--text-muted);
        }

        .analyze-btn {
            position: relative;
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            color: var(--text-primary);
            cursor: pointer;
            font-size: var(--font-size-xs);
            font-family: var(--font-mono);
            white-space: nowrap;
            padding: var(--space-xs) var(--space-md);
            border-radius: 100px;
            height: 32px;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: border-color 0.4s ease, background var(--transition);
            flex-shrink: 0;
            overflow: hidden;
        }

        .analyze-btn:hover:not(.analyzing) {
            border-color: var(--accent);
            background: var(--bg-surface);
        }

        .analyze-btn.analyzing {
            cursor: default;
            border-color: transparent;
        }

        .analyze-btn-content {
            display: flex;
            align-items: center;
            gap: 4px;
            transition: opacity 0.4s ease;
            z-index: 1;
            position: relative;
        }

        .analyze-btn.analyzing .analyze-btn-content {
            opacity: 0;
        }

        .analyze-canvas {
            position: absolute;
            inset: -1px;
            width: calc(100% + 2px);
            height: calc(100% + 2px);
            pointer-events: none;
        }

        /* ── Dos columnas: Escucha | Pantalla ── */

        .split {
            flex: 1;
            display: flex;
            min-height: 0;
        }

        .col {
            display: flex;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
        }

        .col-listen {
            flex: 0 0 42%;
            border-right: 1px solid var(--border);
        }

        .col-screen {
            flex: 1;
        }

        .col-head {
            display: flex;
            align-items: center;
            gap: var(--space-sm);
            padding: var(--space-xs) var(--space-md);
            border-bottom: 1px solid var(--border);
            font-size: var(--font-size-xs);
            color: var(--text-muted);
            min-height: 34px;
        }

        .col-title {
            font-weight: var(--font-weight-semibold);
            color: var(--text-primary);
        }

        .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #666;
            flex-shrink: 0;
        }

        .dot.listening {
            background: #2ecc71;
            animation: pulse 1.6s ease-in-out infinite;
        }

        .dot.paused {
            background: #f1c40f;
        }

        .dot.limited,
        .dot.error {
            background: #e74c3c;
        }

        @keyframes pulse {
            50% {
                opacity: 0.35;
            }
        }

        .spacer {
            flex: 1;
        }

        .pill-btn {
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            color: var(--text-primary);
            cursor: pointer;
            font-size: var(--font-size-xs);
            font-family: var(--font-mono);
            padding: 2px 10px;
            border-radius: 100px;
            white-space: nowrap;
        }

        .pill-btn:hover {
            border-color: var(--accent);
        }

        .pill-btn.on {
            border-color: var(--accent);
            color: var(--accent);
        }

        .usage {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: var(--space-xs) var(--space-md);
            border-bottom: 1px solid var(--border);
            font-size: var(--font-size-xs);
            font-family: var(--font-mono);
            color: var(--text-muted);
        }

        .usage-row {
            display: flex;
            align-items: center;
            gap: var(--space-sm);
        }

        .usage-label {
            flex: 0 0 92px;
        }

        .bar {
            flex: 1;
            height: 5px;
            background: var(--bg-elevated);
            border-radius: 3px;
            overflow: hidden;
        }

        .bar > span {
            display: block;
            height: 100%;
            background: #2ecc71;
        }

        .bar > span.warn {
            background: #f1c40f;
        }

        .bar > span.crit {
            background: #e74c3c;
        }

        .usage-val {
            flex: 0 0 auto;
            min-width: 120px;
            text-align: right;
        }

        .transcript {
            flex: 1;
            overflow-y: auto;
            padding: var(--space-sm) var(--space-md);
            font-size: var(--font-size-sm);
            line-height: 1.5;
            color: var(--text-primary);
            user-select: text;
        }

        .transcript * {
            user-select: text;
            cursor: text;
        }

        .seg {
            margin-bottom: 8px;
        }

        .seg-time {
            font-family: var(--font-mono);
            font-size: var(--font-size-xs);
            color: var(--text-muted);
            margin-right: 6px;
        }

        .notice {
            margin-bottom: 8px;
            padding: 4px 8px;
            border-left: 3px solid #f1c40f;
            background: rgba(241, 196, 15, 0.08);
            font-size: var(--font-size-xs);
        }

        .empty {
            color: var(--text-muted);
            font-size: var(--font-size-xs);
        }
    `;

    static properties = {
        responses: { type: Array },
        currentResponseIndex: { type: Number },
        selectedProfile: { type: String },
        onSendText: { type: Function },
        shouldAnimateResponse: { type: Boolean },
        isAnalyzing: { type: Boolean, state: true },
        _transcript: { state: true },
        _sttState: { state: true },
        _sttUsage: { state: true },
        _llmUsage: { state: true },
        _sttLang: { state: true },
    };

    constructor() {
        super();
        this.responses = [];
        this.currentResponseIndex = -1;
        this.selectedProfile = 'interview';
        this.onSendText = () => {};
        this.isAnalyzing = false;
        this._animFrame = null;
        this._transcript = []; // solo en memoria (F6)
        this._sttState = { state: 'listening', message: '' };
        this._sttUsage = null;
        this._llmUsage = null;
        this._sttLang = 'es';
    }

    getProfileNames() {
        return {
            interview: 'Job Interview',
            sales: 'Sales Call',
            meeting: 'Business Meeting',
            presentation: 'Presentation',
            negotiation: 'Negotiation',
            exam: 'Exam Assistant',
        };
    }

    getCurrentResponse() {
        const profileNames = this.getProfileNames();
        return this.responses.length > 0 && this.currentResponseIndex >= 0
            ? this.responses[this.currentResponseIndex]
            : 'Pulsa **Analyze Screen** o `Ctrl+Enter` para analizar la pantalla.';
    }

    renderMarkdown(content) {
        if (typeof window !== 'undefined' && window.marked) {
            try {
                window.marked.setOptions({
                    breaks: true,
                    gfm: true,
                    sanitize: false,
                });
                let rendered = window.marked.parse(content);
                rendered = this.wrapWordsInSpans(rendered);
                return rendered;
            } catch (error) {
                console.warn('Error parsing markdown:', error);
                return content;
            }
        }
        return content;
    }

    wrapWordsInSpans(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const tagsToSkip = ['PRE'];

        function wrap(node) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() && !tagsToSkip.includes(node.parentNode.tagName)) {
                const words = node.textContent.split(/(\s+)/);
                const frag = document.createDocumentFragment();
                words.forEach(word => {
                    if (word.trim()) {
                        const span = document.createElement('span');
                        span.setAttribute('data-word', '');
                        span.textContent = word;
                        frag.appendChild(span);
                    } else {
                        frag.appendChild(document.createTextNode(word));
                    }
                });
                node.parentNode.replaceChild(frag, node);
            } else if (node.nodeType === Node.ELEMENT_NODE && !tagsToSkip.includes(node.tagName)) {
                Array.from(node.childNodes).forEach(wrap);
            }
        }
        Array.from(doc.body.childNodes).forEach(wrap);
        return doc.body.innerHTML;
    }

    navigateToPreviousResponse() {
        if (this.currentResponseIndex > 0) {
            this.currentResponseIndex--;
            this.dispatchEvent(
                new CustomEvent('response-index-changed', {
                    detail: { index: this.currentResponseIndex },
                })
            );
            this.requestUpdate();
        }
    }

    navigateToNextResponse() {
        if (this.currentResponseIndex < this.responses.length - 1) {
            this.currentResponseIndex++;
            this.dispatchEvent(
                new CustomEvent('response-index-changed', {
                    detail: { index: this.currentResponseIndex },
                })
            );
            this.requestUpdate();
        }
    }

    scrollResponseUp() {
        const container = this.shadowRoot.querySelector('.response-container');
        if (container) {
            const scrollAmount = container.clientHeight * 0.3;
            container.scrollTop = Math.max(0, container.scrollTop - scrollAmount);
        }
    }

    scrollResponseDown() {
        const container = this.shadowRoot.querySelector('.response-container');
        if (container) {
            const scrollAmount = container.clientHeight * 0.3;
            container.scrollTop = Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + scrollAmount);
        }
    }

    connectedCallback() {
        super.connectedCallback();

        if (window.require) {
            const { ipcRenderer } = window.require('electron');

            this.handlePreviousResponse = () => this.navigateToPreviousResponse();
            this.handleNextResponse = () => this.navigateToNextResponse();
            this.handleScrollUp = () => this.scrollResponseUp();
            this.handleScrollDown = () => this.scrollResponseDown();

            ipcRenderer.on('navigate-previous-response', this.handlePreviousResponse);
            ipcRenderer.on('navigate-next-response', this.handleNextResponse);
            ipcRenderer.on('scroll-response-up', this.handleScrollUp);
            ipcRenderer.on('scroll-response-down', this.handleScrollDown);

            // ── Escucha (Fase 1) ──
            this.handleSttSegment = (e, seg) => this._addTranscript({ kind: 'seg', text: seg.text, at: seg.at });
            this.handleSttStatus = (e, st) => {
                this._sttState = st;
                if ((st.state === 'warning' || st.state === 'limited' || st.state === 'error') && st.message) {
                    this._addTranscript({ kind: 'notice', text: st.message, at: Date.now() });
                }
            };
            this.handleSttUsage = (e, u) => (this._sttUsage = u);
            this.handleLlmUsage = (e, u) => (this._llmUsage = u);
            ipcRenderer.on('stt:segment', this.handleSttSegment);
            ipcRenderer.on('stt:status', this.handleSttStatus);
            ipcRenderer.on('stt:usage', this.handleSttUsage);
            ipcRenderer.on('llm:usage', this.handleLlmUsage);
            ipcRenderer.invoke('stt:get-state').then(s => {
                if (s) {
                    this._sttLang = s.language;
                    if (s.paused) this._sttState = { state: 'paused', message: '' };
                }
            });
        }
    }

    _addTranscript(item) {
        const list = [...this._transcript, item];
        this._transcript = list.length > 300 ? list.slice(-300) : list;
        // Desplazamiento automático solo si el usuario ya estaba abajo.
        const box = this.shadowRoot && this.shadowRoot.querySelector('.transcript');
        const atBottom = !box || box.scrollHeight - box.scrollTop - box.clientHeight < 40;
        if (atBottom) {
            this.updateComplete.then(() => {
                const b = this.shadowRoot.querySelector('.transcript');
                if (b) b.scrollTop = b.scrollHeight;
            });
        }
    }

    async _togglePause() {
        const { ipcRenderer } = window.require('electron');
        const paused = await ipcRenderer.invoke('stt:set-paused', this._sttState.state !== 'paused');
        this._sttState = { state: paused ? 'paused' : 'listening', message: '' };
    }

    async _setLang(lang) {
        const { ipcRenderer } = window.require('electron');
        this._sttLang = await ipcRenderer.invoke('stt:set-language', lang);
    }

    _fmtDur(sec) {
        if (sec === null || sec === undefined || isNaN(sec)) return '—';
        sec = Math.max(0, Math.round(sec));
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(sec % 60).padStart(2, '0')} s`;
    }

    _bar(remaining, limit) {
        if (remaining === null || remaining === undefined || !limit) return html`<div class="bar"></div>`;
        const pct = Math.max(0, Math.min(100, (remaining / limit) * 100));
        const cls = pct < 10 ? 'crit' : pct < 25 ? 'warn' : '';
        return html`<div class="bar"><span class=${cls} style="width:${pct}%"></span></div>`;
    }

    _renderUsage() {
        const u = this._sttUsage;
        const l = this._llmUsage;
        const dayRemaining = u ? Math.max(0, u.dayAudioLimitSec - u.dayAudioSec) : null;
        const hourRemaining = u ? u.hourRemainingAudioSec : null;
        const llmReq = l && l.remainingRequestsDay !== null ? Number(l.remainingRequestsDay) : null;
        const llmLimit = l && l.limitRequestsDay !== null ? Number(l.limitRequestsDay) : null;
        return html`
            <div class="usage" title="Voz que aún se puede transcribir (los silencios no cuentan). Hoy = estimación local; esta hora = dato de Groq.">
                <div class="usage-row">
                    <span class="usage-label">Voz esta hora</span>
                    ${this._bar(hourRemaining, u && u.hourAudioLimitSec)}
                    <span class="usage-val">${hourRemaining === null ? 'sin datos aún' : `quedan ${this._fmtDur(hourRemaining)}`}</span>
                </div>
                <div class="usage-row">
                    <span class="usage-label">Voz hoy</span>
                    ${this._bar(dayRemaining, u && u.dayAudioLimitSec)}
                    <span class="usage-val">${dayRemaining === null ? '—' : `quedan ≈${this._fmtDur(dayRemaining)}`}</span>
                </div>
                <div class="usage-row">
                    <span class="usage-label">Capturas hoy</span>
                    ${this._bar(llmReq, llmLimit)}
                    <span class="usage-val">${llmReq === null ? 'sin datos aún' : `quedan ${llmReq} de ${llmLimit}`}</span>
                </div>
            </div>
        `;
    }

    _renderListenColumn() {
        const st = this._sttState.state;
        const label =
            st === 'paused' ? 'En pausa' : st === 'limited' ? 'Esperando límite de Groq' : st === 'stopped' ? 'Detenida' : 'Escuchando';
        const fmtTime = t => new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        return html`
            <section class="col col-listen">
                <div class="col-head">
                    <span class="dot ${st}"></span>
                    <span class="col-title">🎧 Escucha</span>
                    <span>${label}</span>
                    <span class="spacer"></span>
                    <button class="pill-btn ${this._sttLang === 'es' ? 'on' : ''}" @click=${() => this._setLang('es')} title="Idioma de la sesión">ES</button>
                    <button class="pill-btn ${this._sttLang === 'en' ? 'on' : ''}" @click=${() => this._setLang('en')} title="Idioma de la sesión">EN</button>
                    <button class="pill-btn" @click=${this._togglePause}>${st === 'paused' ? '▶ Reanudar' : '⏸ Pausar'}</button>
                </div>
                ${this._renderUsage()}
                <div class="transcript">
                    ${this._transcript.length === 0
                        ? html`<div class="empty">
                              ${st === 'paused' ? 'Escucha en pausa: no se envía audio a Groq.' : 'Esperando voz del audio del sistema…'}
                          </div>`
                        : this._transcript.map(item =>
                              item.kind === 'notice'
                                  ? html`<div class="notice">🟨 ${item.text}</div>`
                                  : html`<div class="seg"><span class="seg-time">${fmtTime(item.at)}</span>${item.text}</div>`
                          )}
                </div>
            </section>
        `;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopWaveformAnimation();

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            if (this.handlePreviousResponse) ipcRenderer.removeListener('navigate-previous-response', this.handlePreviousResponse);
            if (this.handleNextResponse) ipcRenderer.removeListener('navigate-next-response', this.handleNextResponse);
            if (this.handleScrollUp) ipcRenderer.removeListener('scroll-response-up', this.handleScrollUp);
            if (this.handleScrollDown) ipcRenderer.removeListener('scroll-response-down', this.handleScrollDown);
            if (this.handleSttSegment) ipcRenderer.removeListener('stt:segment', this.handleSttSegment);
            if (this.handleSttStatus) ipcRenderer.removeListener('stt:status', this.handleSttStatus);
            if (this.handleSttUsage) ipcRenderer.removeListener('stt:usage', this.handleSttUsage);
            if (this.handleLlmUsage) ipcRenderer.removeListener('llm:usage', this.handleLlmUsage);
        }
    }

    async handleSendText() {
        const textInput = this.shadowRoot.querySelector('#textInput');
        if (textInput && textInput.value.trim()) {
            const message = textInput.value.trim();
            textInput.value = '';
            await this.onSendText(message);
        }
    }

    handleTextKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSendText();
        }
    }

    async handleScreenAnswer() {
        if (this.isAnalyzing) return;
        if (window.captureManualScreenshot) {
            this.isAnalyzing = true;
            this._responseCountWhenStarted = this.responses.length;
            window.captureManualScreenshot();
        }
    }

    _startWaveformAnimation() {
        const canvas = this.shadowRoot.querySelector('.analyze-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const dangerColor = getComputedStyle(this).getPropertyValue('--danger').trim() || '#EF4444';
        const startTime = performance.now();
        const FADE_IN = 0.5; // seconds
        const PARTICLE_SPREAD = 4; // px inward from border
        const PARTICLE_COUNT = 250;

        // Pill perimeter helpers
        const w = rect.width;
        const h = rect.height;
        const r = h / 2; // pill radius = half height
        const straightLen = w - 2 * r;
        const arcLen = Math.PI * r;
        const perimeter = 2 * straightLen + 2 * arcLen;

        // Given a distance along the perimeter, return {x, y, nx, ny} (position + inward normal)
        const pointOnPerimeter = (d) => {
            d = ((d % perimeter) + perimeter) % perimeter;
            // Top straight: left to right
            if (d < straightLen) {
                return { x: r + d, y: 0, nx: 0, ny: 1 };
            }
            d -= straightLen;
            // Right arc
            if (d < arcLen) {
                const angle = -Math.PI / 2 + (d / arcLen) * Math.PI;
                return {
                    x: w - r + Math.cos(angle) * r,
                    y: r + Math.sin(angle) * r,
                    nx: -Math.cos(angle),
                    ny: -Math.sin(angle),
                };
            }
            d -= arcLen;
            // Bottom straight: right to left
            if (d < straightLen) {
                return { x: w - r - d, y: h, nx: 0, ny: -1 };
            }
            d -= straightLen;
            // Left arc
            const angle = Math.PI / 2 + (d / arcLen) * Math.PI;
            return {
                x: r + Math.cos(angle) * r,
                y: r + Math.sin(angle) * r,
                nx: -Math.cos(angle),
                ny: -Math.sin(angle),
            };
        };

        // Pre-seed random offsets for stable particles
        const seeds = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            seeds.push({ pos: Math.random(), drift: Math.random(), depthSeed: Math.random() });
        }

        const draw = (now) => {
            const elapsed = (now - startTime) / 1000;
            const fade = Math.min(1, elapsed / FADE_IN);

            ctx.clearRect(0, 0, w, h);

            // ── Particle border ──
            ctx.fillStyle = dangerColor;
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const s = seeds[i];
                const along = (s.pos + s.drift * elapsed * 0.03) * perimeter;
                const depth = s.depthSeed * PARTICLE_SPREAD;
                const density = 1 - depth / PARTICLE_SPREAD;

                if (Math.random() > density) continue;

                const p = pointOnPerimeter(along);
                const px = p.x + p.nx * depth;
                const py = p.y + p.ny * depth;
                const size = 0.8 + density * 0.6;

                ctx.globalAlpha = fade * density * 0.85;
                ctx.beginPath();
                ctx.arc(px, py, size, 0, Math.PI * 2);
                ctx.fill();
            }

            // ── Waveform ──
            const midY = h / 2;
            const waves = [
                { freq: 3, amp: 0.35, speed: 2.5, opacity: 0.9, width: 1.8 },
                { freq: 5, amp: 0.2, speed: 3.5, opacity: 0.5, width: 1.2 },
                { freq: 7, amp: 0.12, speed: 5, opacity: 0.3, width: 0.8 },
            ];

            for (const wave of waves) {
                ctx.beginPath();
                ctx.strokeStyle = dangerColor;
                ctx.globalAlpha = wave.opacity * fade;
                ctx.lineWidth = wave.width;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                for (let x = 0; x <= w; x++) {
                    const norm = x / w;
                    const envelope = Math.sin(norm * Math.PI);
                    const y = midY + Math.sin(norm * Math.PI * 2 * wave.freq + elapsed * wave.speed) * (midY * wave.amp) * envelope;
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            ctx.globalAlpha = 1;
            this._animFrame = requestAnimationFrame(draw);
        };

        this._animFrame = requestAnimationFrame(draw);
    }

    _stopWaveformAnimation() {
        if (this._animFrame) {
            cancelAnimationFrame(this._animFrame);
            this._animFrame = null;
        }
        const canvas = this.shadowRoot.querySelector('.analyze-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            const container = this.shadowRoot.querySelector('.response-container');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 0);
    }

    firstUpdated() {
        super.firstUpdated();
        this.updateResponseContent();
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('responses') || changedProperties.has('currentResponseIndex')) {
            this.updateResponseContent();
        }

        if (changedProperties.has('isAnalyzing')) {
            if (this.isAnalyzing) {
                this._startWaveformAnimation();
            } else {
                this._stopWaveformAnimation();
            }
        }

        if (changedProperties.has('responses') && this.isAnalyzing) {
            if (this.responses.length > this._responseCountWhenStarted) {
                this.isAnalyzing = false;
            }
        }
    }

    updateResponseContent() {
        const container = this.shadowRoot.querySelector('#responseContainer');
        if (container) {
            const currentResponse = this.getCurrentResponse();
            const renderedResponse = this.renderMarkdown(currentResponse);
            container.innerHTML = renderedResponse;
            if (this.shouldAnimateResponse) {
                this.dispatchEvent(new CustomEvent('response-animation-complete', { bubbles: true, composed: true }));
            }
        }
    }

    render() {
        const hasMultipleResponses = this.responses.length > 1;

        return html`
          <div class="split">
            ${this._renderListenColumn()}
            <section class="col col-screen">
            <div class="col-head">
                <span class="col-title">🖥️ Pantalla</span>
                <span>Solo cuando tú lo pides (botón o Ctrl+Enter)</span>
            </div>
            <div class="response-container" id="responseContainer"></div>

            ${hasMultipleResponses ? html`
                <div class="response-nav">
                    <button class="nav-btn" @click=${this.navigateToPreviousResponse} ?disabled=${this.currentResponseIndex <= 0} title="Previous response">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" />
                        </svg>
                    </button>
                    <span class="response-counter">${this.currentResponseIndex + 1} of ${this.responses.length}</span>
                    <button class="nav-btn" @click=${this.navigateToNextResponse} ?disabled=${this.currentResponseIndex >= this.responses.length - 1} title="Next response">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
            ` : ''}

            <div class="input-bar">
                <div class="input-bar-inner">
                    <input
                        type="text"
                        id="textInput"
                        placeholder="Type a message..."
                        @keydown=${this.handleTextKeydown}
                    />
                </div>
                <button class="analyze-btn ${this.isAnalyzing ? 'analyzing' : ''}" @click=${this.handleScreenAnswer}>
                    <canvas class="analyze-canvas"></canvas>
                    <span class="analyze-btn-content">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
                            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 3v7h6l-8 11v-7H5z" />
                        </svg>
                        Analyze Screen
                    </span>
                </button>
            </div>
            </section>
          </div>
        `;
    }
}

customElements.define('assistant-view', AssistantView);
