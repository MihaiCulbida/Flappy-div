"use strict";
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const hud = document.getElementById('hud');
const overlay = document.getElementById('overlay');
const W = canvas.width, H = canvas.height;
const GRAVITY = 0.15;
const FLAP = -4.6;
const MAX_FALL = 5.5;
const PIPE_GAP = 190;
const PIPE_W = 62;
const PIPE_SPEED = 1.5;
const PIPE_INTERVAL = 210;
const GROUND_H = 46;
let state = 'start';
let score = 0;
let best = 0;
let frame = 0;
let pipes = [];
let clouds = [];
const bird = { x: 260, y: H / 2, vy: 0 };
const spriteCanvas = document.createElement('canvas');
spriteCanvas.width = 1050;
spriteCanvas.height = 400;
const sctx = spriteCanvas.getContext('2d');
sctx.imageSmoothingEnabled = false;
function buildSprite() {
    sctx.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height);
    sctx.font = '600 25px Consolas, Menlo, monospace';
    sctx.textBaseline = 'middle';
    sctx.fillStyle = '#000000';
    const lines = [
        ' <img ',
        ' src="https://github.com/MihaiCulbida/Flappy-div ',
        '  data-index="0x1F9A"',
        ' data-quantum-state="superposed"',
        '  class="w-8 h-8" ',
        ' will-change-transform" ',
        ' [0.94] ',
        '/>',
    ];
    const lineH = 30;
    let maxW = 0;
    lines.forEach(t => {
        const w = sctx.measureText(t).width;
        if (w > maxW)
            maxW = w;
    });
    const boxW = maxW;
    const boxH = lines.length * lineH;
    const startX = (spriteCanvas.width - boxW) / 2;
    const startY = (spriteCanvas.height - boxH) / 2;
    lines.forEach((t, i) => {
        sctx.fillText(t, startX, startY + i * lineH + lineH / 2);
    });
    return { boxW, boxH };
}
const spriteBox = buildSprite();
function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
}
function drawCloudLobe(cx, cy, r) {
    ctx.moveTo(cx + r, cy);
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
}
function drawCloud(c) {
    ctx.save();
    ctx.globalAlpha = c.alpha;
    ctx.translate(c.x, c.y);
    ctx.scale(c.scale, c.scale);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    drawCloudLobe(0, 0, 20);
    drawCloudLobe(22, -8, 16);
    drawCloudLobe(-22, -6, 15);
    drawCloudLobe(10, 8, 18);
    drawCloudLobe(-12, 8, 16);
    ctx.fill();
    ctx.restore();
}
function makeClouds() {
    clouds = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
        clouds.push({
            x: Math.random() * W,
            y: 30 + Math.random() * 260,
            scale: 0.6 + Math.random() * 0.9,
            alpha: 0.6 + Math.random() * 0.35,
            speed: 0.12 + Math.random() * 0.25,
        });
    }
}
makeClouds();
function resetGame() {
    bird.y = H / 2;
    bird.vy = 0;
    pipes = [];
    score = 0;
    frame = 0;
    makeClouds();
}
function spawnPipe() {
    const margin = 60;
    const gapY = margin + Math.random() * (H - GROUND_H - margin * 2 - PIPE_GAP);
    pipes.push({ x: W + PIPE_W, gapY, passed: false });
}
function flap() {
    if (state === 'start') {
        state = 'playing';
        overlay.classList.add('hidden');
    }
    if (state === 'playing') {
        bird.vy = FLAP;
    }
    if (state === 'gameover') {
        resetGame();
        state = 'playing';
        overlay.classList.add('hidden');
    }
}
function endGame() {
    state = 'gameover';
    if (score > best)
        best = score;
    saveBest(best);
    overlay.innerHTML =
        '<h1>Game Over</h1>' +
            '<p>Click / Tap / Space to start</p>' +
            '<div class="score-line">Score: ' + score + ' &nbsp;|&nbsp; Record: ' + best + '</div>';
    overlay.classList.remove('hidden');
}
async function loadBest() {
    try {
        const res = await window.storage.get('flappy-code-best', false);
        if (res && res.value)
            best = parseInt(res.value, 10) || 0;
    }
    catch (e) {
        best = 0;
    }
}
async function saveBest(value) {
    try {
        await window.storage.set('flappy-code-best', String(value), false);
    }
    catch (e) { }
}
function update() {
    frame++;
    clouds.forEach(c => {
        c.x -= c.speed;
        if (c.x < -60) {
            c.x = W + 60;
            c.y = 30 + Math.random() * 260;
        }
    });
    if (state !== 'playing')
        return;
    bird.vy += GRAVITY;
    if (bird.vy > MAX_FALL)
        bird.vy = MAX_FALL;
    bird.y += bird.vy;
    if (frame % PIPE_INTERVAL === 0)
        spawnPipe();
    pipes.forEach(p => { p.x -= PIPE_SPEED; });
    pipes = pipes.filter(p => p.x > -PIPE_W);
    pipes.forEach(p => {
        if (!p.passed && p.x + PIPE_W < bird.x - 20) {
            p.passed = true;
            score++;
        }
    });
    const bx1 = bird.x - 18;
    const bx2 = bird.x + 18;
    const by1 = bird.y - 12;
    const by2 = bird.y + 12;
    if (by2 > H - GROUND_H || by1 < 0) {
        endGame();
        return;
    }
    for (const p of pipes) {
        const withinX = bx2 > p.x && bx1 < p.x + PIPE_W;
        if (withinX) {
            const gapTop = p.gapY;
            const gapBottom = p.gapY + PIPE_GAP;
            if (by1 < gapTop || by2 > gapBottom) {
                endGame();
                return;
            }
        }
    }
}
function drawPipes() {
    pipes.forEach(p => {
        const gapTop = p.gapY;
        const gapBottom = p.gapY + PIPE_GAP;
        const grad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
        grad.addColorStop(0, '#3fae4f');
        grad.addColorStop(0.5, '#6ee87f');
        grad.addColorStop(1, '#3fae4f');
        ctx.fillStyle = grad;
        ctx.fillRect(p.x, 0, PIPE_W, gapTop);
        ctx.fillRect(p.x, gapBottom, PIPE_W, H - GROUND_H - gapBottom);
        ctx.strokeStyle = '#2c7a38';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, 0, PIPE_W, gapTop);
        ctx.strokeRect(p.x, gapBottom, PIPE_W, H - GROUND_H - gapBottom);
    });
}
function drawBird() {
    const angle = Math.max(-0.5, Math.min(0.9, bird.vy / 12));
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(angle);
    const scale = 0.42;
    const dw = spriteBox.boxW * scale;
    const dh = spriteBox.boxH * scale;
    ctx.drawImage(spriteCanvas, (spriteCanvas.width - spriteBox.boxW) / 2, (spriteCanvas.height - spriteBox.boxH) / 2, spriteBox.boxW, spriteBox.boxH, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
}
function drawGround() {
    const gy = H - GROUND_H;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, gy, W, GROUND_H);
}
function draw() {
    ctx.clearRect(0, 0, W, H);
    clouds.forEach(drawCloud);
    drawPipes();
    drawBird();
    drawGround();
    hud.textContent = state === 'start' ? '' : String(score);
}
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}
canvas.addEventListener('click', flap);
overlay.addEventListener('click', flap);
window.addEventListener('keydown', e => {
    if (e.code === 'Space') {
        e.preventDefault();
        flap();
    }
});
loadBest().then(loop);
