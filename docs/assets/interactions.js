/* §11.3 & §11.4 — Pricing card 3D tilt + depth lighting; Hero spotlight + parallax.
 * §new — Hero letter texture canvas with trickle refresh; card flicker fix.
 * CSS variables are set here; visual treatment is in motion.css. */
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
// ── Hero letter texture ───────────────────────────────────────────────
// Char grid: 8px cell, desaturated grey-green, low-contrast against white.
// Trickle: each interval replaces ~7% of visible cells randomly, staggered.
const CHAR_SIZE = 8;
const CHAR_COLOR = '#5d7a66'; // desaturated grey-green (low saturation)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz023456789'.split('');
function buildGrid(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return null;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    if (!W || !H)
        return null;
    canvas.width = W;
    canvas.height = H;
    const cols = Math.ceil(W / CHAR_SIZE) + 1;
    const rows = Math.ceil(H / CHAR_SIZE) + 1;
    const cells = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            cells[r * cols + c] = (r * 1619 + c * 7) % CHARS.length;
    return { canvas, ctx, cols, rows, cells };
}
function paintGrid(grid) {
    const { canvas, ctx, cols, rows, cells } = grid;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${CHAR_SIZE}px ui-monospace, Consolas, monospace`;
    ctx.fillStyle = CHAR_COLOR;
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'top';
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            ctx.fillText(CHARS[cells[r * cols + c]], c * CHAR_SIZE, r * CHAR_SIZE);
}
function setupCharCanvas(id, trickle) {
    const canvas = document.getElementById(id);
    if (!canvas)
        return null;
    let grid = buildGrid(canvas);
    if (!grid)
        return null;
    paintGrid(grid);
    // Redraw on resize
    if (typeof ResizeObserver === 'function') {
        new ResizeObserver(() => {
            grid = buildGrid(canvas);
            if (grid)
                paintGrid(grid);
        }).observe(canvas);
    }
    else {
        window.addEventListener('resize', () => {
            grid = buildGrid(canvas);
            if (grid)
                paintGrid(grid);
        }, { passive: true });
    }
    if (!trickle)
        return grid;
    // Trickle refresh: replace ~7% of cells every 100–160ms, staggered
    let trickling = false;
    let trickleHandle = null;
    function doTrickle() {
        if (!grid)
            return;
        const { cols, rows, cells, ctx } = grid;
        const total = cols * rows;
        const count = Math.floor(total * 0.07);
        ctx.font = `${CHAR_SIZE}px ui-monospace, Consolas, monospace`;
        ctx.fillStyle = CHAR_COLOR;
        ctx.globalAlpha = 1;
        ctx.textBaseline = 'top';
        for (let i = 0; i < count; i++) {
            const idx = Math.floor(Math.random() * total);
            const r = Math.floor(idx / cols);
            const c = idx % cols;
            const newChar = Math.floor(Math.random() * CHARS.length);
            cells[idx] = newChar;
            // Clear and repaint single cell
            ctx.clearRect(c * CHAR_SIZE, r * CHAR_SIZE, CHAR_SIZE, CHAR_SIZE);
            ctx.fillText(CHARS[newChar], c * CHAR_SIZE, r * CHAR_SIZE);
        }
    }
    function startTrickle() {
        if (trickling || reducedMotion.matches)
            return;
        trickling = true;
        // Random interval in 100–160ms range per tick
        function schedule() {
            if (!trickling)
                return;
            const delay = 100 + Math.floor(Math.random() * 60);
            trickleHandle = setTimeout(() => {
                doTrickle();
                schedule();
            }, delay);
        }
        schedule();
    }
    function stopTrickle() {
        trickling = false;
        if (trickleHandle !== null) {
            clearTimeout(trickleHandle);
            trickleHandle = null;
        }
    }
    // Expose start/stop on element for hero enter/leave
    canvas.__startTrickle = startTrickle;
    canvas.__stopTrickle = stopTrickle;
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches)
        stopTrickle(); });
    return grid;
}
// Static canvas (reduced-motion grain, no trickle)
setupCharCanvas('hero-char-canvas-static', false);
// Pointer canvas (trickle active while hero is lit)
setupCharCanvas('hero-char-canvas', true);
// ── Pricing card 3D tilt — real hit box, lerp smoothing ───────────────
// Using lerp so the tilt smoothly follows the pointer without restarting on
// each mousemove. Target angle updates immediately; displayed angle lerps.
function setupTiltCard(card) {
    let hitZone = card.closest('.pricing-card-hit') ?? null;
    if (!hitZone) {
        hitZone = document.createElement('div');
        hitZone.className = 'pricing-card-hit';
        card.parentNode.insertBefore(hitZone, card);
        hitZone.appendChild(card);
    }
    // Target (from pointer) and current (lerped) normalized coords
    let targetCx = 0, targetCy = 0, targetMx = 0.5, targetMy = 0.5;
    let currentCx = 0, currentCy = 0, currentMx = 0.5, currentMy = 0.5;
    let active = false;
    let rafId = null;
    const LERP_ENTER = 0.12; // how fast to follow pointer while active
    const LERP_LEAVE = 0.08; // how fast to settle back to 0 after leave
    function lerp(a, b, t) { return a + (b - a) * t; }
    function animate() {
        const factor = active ? LERP_ENTER : LERP_LEAVE;
        currentCx = lerp(currentCx, targetCx, factor);
        currentCy = lerp(currentCy, targetCy, factor);
        currentMx = lerp(currentMx, targetMx, factor);
        currentMy = lerp(currentMy, targetMy, factor);
        card.style.setProperty('--cx', currentCx.toFixed(3));
        card.style.setProperty('--cy', currentCy.toFixed(3));
        card.style.setProperty('--mx', currentMx.toFixed(3));
        card.style.setProperty('--my', currentMy.toFixed(3));
        // Keep animating until settled (threshold 0.001)
        const settled = Math.abs(currentCx - targetCx) < 0.001 &&
            Math.abs(currentCy - targetCy) < 0.001 &&
            Math.abs(currentMx - targetMx) < 0.001 &&
            Math.abs(currentMy - targetMy) < 0.001;
        if (!settled) {
            rafId = requestAnimationFrame(animate);
        }
        else {
            rafId = null;
            if (!active)
                card.classList.remove('is-tilt-active');
        }
    }
    function ensureAnimating() {
        if (rafId === null)
            rafId = requestAnimationFrame(animate);
    }
    hitZone.addEventListener('pointermove', (event) => {
        if (!finePointer.matches || reducedMotion.matches)
            return;
        const rect = hitZone.getBoundingClientRect();
        const nx = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const ny = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        targetCx = (nx - 0.5) * 2;
        targetCy = (ny - 0.5) * 2;
        targetMx = nx;
        targetMy = ny;
        ensureAnimating();
    }, { passive: true });
    hitZone.addEventListener('pointerenter', () => {
        if (!finePointer.matches || reducedMotion.matches)
            return;
        active = true;
        card.classList.add('is-tilt-active');
        ensureAnimating();
    }, { passive: true });
    hitZone.addEventListener('pointerleave', () => {
        active = false;
        targetCx = 0;
        targetCy = 0;
        targetMx = 0.5;
        targetMy = 0.5;
        // Don't remove is-tilt-active yet — animate() removes it once settled
        ensureAnimating();
    }, { passive: true });
}
document.querySelectorAll('.pricing-card').forEach(setupTiltCard);
// ── Hero spotlight + trickle control + char opacity (move bright / idle dim) ──
// Rules:
//   OPACITY_REST = 0.35 — always visible while pointer is inside Hero
//   OPACITY_PEAK = 1.0  — while pointer is moving
//
//   pointermove → only update lx/ly coords; reschedule idle timer
//               → start rise animation only if one isn't already running upward
//   idle 150ms  → start fade animation (0.35 target)
//   fade mid-move → rise from current opacity (no reset, no blank frame)
//   pointerleave → stop trickle and let the mask fade in place
//
// Key invariant: canvas is NEVER cleared or resized during active pointer
// (resize only happens via ResizeObserver on the canvas element itself).
const hero = document.querySelector('.hero');
const trickleCanvas = document.getElementById('hero-char-canvas');
if (hero && trickleCanvas) {
    const charMask = trickleCanvas.closest('.hero-char-mask');
    const OPACITY_PEAK = 1.0;
    const OPACITY_REST = 0.35; // matches CSS fallback
    const RISE_MS = 150; // rest → peak, ease-in-out sine
    const IDLE_WAIT_MS = 150; // idle duration before fade starts
    const FADE_MS = 450; // peak → rest, ease-in-out sine
    // ease-in-out sine: symmetric, smooth start and end
    function easeInOutSine(t) {
        return -(Math.cos(Math.PI * t) - 1) / 2;
    }
    let currentOpacity = OPACITY_REST;
    let animRafId = null;
    let idleTimerId = null;
    // Direction of current animation: 'rise' | 'fade' | null
    let animDirection = null;
    let animStart = 0;
    let animFrom = OPACITY_REST;
    let animTo = OPACITY_REST;
    let animDuration = RISE_MS;
    function applyOpacity(v) {
        currentOpacity = Math.max(0, Math.min(1, v));
        trickleCanvas.style.opacity = currentOpacity.toFixed(4);
    }
    function stopAnim() {
        if (animRafId !== null) {
            cancelAnimationFrame(animRafId);
            animRafId = null;
        }
        animDirection = null;
    }
    function stopIdle() {
        if (idleTimerId !== null) {
            clearTimeout(idleTimerId);
            idleTimerId = null;
        }
    }
    function startAnim(to, durationMs, dir) {
        stopAnim();
        animFrom = currentOpacity;
        animTo = to;
        animDuration = durationMs;
        animDirection = dir;
        animStart = performance.now();
        function step(now) {
            const raw = Math.min(1, (now - animStart) / animDuration);
            const eased = easeInOutSine(raw);
            applyOpacity(animFrom + (animTo - animFrom) * eased);
            if (raw < 1) {
                animRafId = requestAnimationFrame(step);
            }
            else {
                animRafId = null;
                animDirection = null;
            }
        }
        animRafId = requestAnimationFrame(step);
    }
    function scheduleIdle() {
        stopIdle();
        idleTimerId = setTimeout(() => {
            idleTimerId = null;
            startAnim(OPACITY_REST, FADE_MS, 'fade');
        }, IDLE_WAIT_MS);
    }
    // Hero lx/ly position tracking (independent of opacity animation)
    let heroFrame = null;
    let lx = 0.5, ly = 0.5;
    const flushHero = () => {
        heroFrame = null;
        hero.style.setProperty('--lx', lx.toFixed(3));
        hero.style.setProperty('--ly', ly.toFixed(3));
    };
    const locatePointer = (event) => {
        const rect = hero.getBoundingClientRect();
        lx = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        ly = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    };
    hero.addEventListener('pointermove', (event) => {
        if (!finePointer.matches || reducedMotion.matches)
            return;
        // 1. Update mask position (rAF-batched, never clears canvas)
        locatePointer(event);
        if (heroFrame === null)
            heroFrame = requestAnimationFrame(flushHero);
        // 2. Reschedule idle timer (each move pushes the fade further out)
        scheduleIdle();
        // 3. Start rise only if we're not already rising
        //    (avoids cancelling an in-progress rise on every mousemove event)
        if (animDirection !== 'rise') {
            startAnim(OPACITY_PEAK, RISE_MS, 'rise');
        }
    }, { passive: true });
    hero.addEventListener('pointerenter', (event) => {
        if (!finePointer.matches || reducedMotion.matches)
            return;
        const maskOpacity = charMask ? Number(getComputedStyle(charMask).opacity) : 0;
        applyOpacity(Math.max(OPACITY_REST, currentOpacity * maskOpacity));
        locatePointer(event);
        flushHero();
        hero.classList.add('hero-is-lit');
        trickleCanvas.__startTrickle?.();
    }, { passive: true });
    hero.addEventListener('pointerleave', () => {
        stopIdle();
        stopAnim();
        trickleCanvas.__stopTrickle?.();
        // Preserve the current texture and position while the mask fades out.
        hero.classList.remove('hero-is-lit');
        if (heroFrame !== null) {
            cancelAnimationFrame(heroFrame);
            heroFrame = null;
        }
    }, { passive: true });
}
else if (hero) {
    // Fallback: trickleCanvas not found — keep original simpler logic
    let heroFrame = null;
    let lx = 0.5, ly = 0.5;
    const flushHero = () => {
        heroFrame = null;
        hero.style.setProperty('--lx', lx.toFixed(3));
        hero.style.setProperty('--ly', ly.toFixed(3));
    };
    hero.addEventListener('pointermove', (event) => {
        if (!finePointer.matches || reducedMotion.matches)
            return;
        const rect = hero.getBoundingClientRect();
        lx = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        ly = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        if (heroFrame === null)
            heroFrame = requestAnimationFrame(flushHero);
    }, { passive: true });
    hero.addEventListener('pointerenter', () => {
        if (!finePointer.matches || reducedMotion.matches)
            return;
        hero.classList.add('hero-is-lit');
    }, { passive: true });
    hero.addEventListener('pointerleave', () => {
        hero.classList.remove('hero-is-lit');
        if (heroFrame !== null) {
            cancelAnimationFrame(heroFrame);
            heroFrame = null;
        }
        hero.style.setProperty('--lx', '0.5');
        hero.style.setProperty('--ly', '0.5');
    }, { passive: true });
}
finePointer.addEventListener('change', () => {
    if (!finePointer.matches) {
        document.querySelectorAll('.pricing-card.is-tilt-active').forEach(c => c.classList.remove('is-tilt-active'));
        hero?.classList.remove('hero-is-lit');
        trickleCanvas?.__stopTrickle?.();
    }
});
export {};
