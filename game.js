const canvas = document.querySelector("#game");
const context = canvas.getContext("2d");
const coinCount = document.querySelector("#coin-count");
const statusText = document.querySelector("#game-status");
const overlay = document.querySelector("#game-overlay");
const overlayEyebrow = document.querySelector("#overlay-eyebrow");
const overlayTitle = document.querySelector("#overlay-title");
const overlayMessage = document.querySelector("#overlay-message");
const restartButton = document.querySelector("#restart-button");
const resetButton = document.querySelector("#reset-button");
const bgmButton = document.querySelector("#bgm-button");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const ENTITY_SCALE = window.matchMedia("(max-width: 1500px)").matches ? 1.4 : 1;
const PLATFORM_BOTTOM = HEIGHT + 20;
const WORLD_WIDTH = 3000;
const GROUND_Y = 470;
const GRAVITY = 1800;
const RUN_SPEED = 310;
const JUMP_SPEED = 690;

const platforms = [
    { x: 0, y: GROUND_Y, width: 620 },
    { x: 720, y: GROUND_Y, width: 630 },
    { x: 1480, y: GROUND_Y, width: 620 },
    { x: 2240, y: GROUND_Y, width: 760 },
    { x: 265, y: 365, width: 150 },
    { x: 850, y: 355, width: 160 },
    { x: 1110, y: 300, width: 150 },
    { x: 1570, y: 360, width: 165 },
    { x: 1855, y: 315, width: 150 },
    { x: 2350, y: 360, width: 160 },
    { x: 2600, y: 305, width: 145 },
];

const hazards = [
    { x: 505, y: GROUND_Y - 29, width: 48, height: 28 },
    { x: 1015, y: GROUND_Y - 29, width: 50, height: 28 },
    { x: 1745, y: GROUND_Y - 29, width: 52, height: 28 },
    { x: 2460, y: GROUND_Y - 29, width: 50, height: 28 },
];

const coinPositions = [
    { x: 330, y: 320 },
    { x: 575, y: 400 },
    { x: 910, y: 310 },
    { x: 1190, y: 255 },
    { x: 1635, y: 315 },
    { x: 1920, y: 270 },
    { x: 2425, y: 315 },
    { x: 2665, y: 260 },
];

const enemyPositions = [
    { x: 435, minX: 415, maxX: 505 },
    { x: 780, minX: 760, maxX: 850 },
];

const stars = Array.from({ length: 65 }, (_, index) => ({
    x: (index * 173 + 31) % WORLD_WIDTH,
    y: 24 + ((index * 67) % 270),
    size: index % 7 === 0 ? 2 : 1,
    phase: index * 0.7,
}));

const rainDrops = Array.from({ length: 72 }, (_, index) => ({
    x: (index * 137 + 29) % WIDTH,
    y: (index * 83 + 17) % HEIGHT,
    length: 8 + (index % 5) * 3,
    speed: 150 + (index % 7) * 24,
}));

const input = { left: false, right: false, jump: false };
let player;
let coins;
let enemies;
const bossBird = {
    x: 0,
    y: 130,
    width: 132 * ENTITY_SCALE,
    height: 88 * ENTITY_SCALE,
    hitCooldown: 0,
    previousPhase: 0,
};
let cameraX = 0;
let elapsed = 0;
let bossElapsed = 0;
let gameState = "playing";
let lastTime = 0;
let audioContext;
let bgmTimer = null;
let bgmEnabled = false;
let bgmStarting = false;
let bgmNoteIndex = 0;
const bgmNotes = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46];
const AudioContextClass = window.AudioContext;

function updateBgmButton() {
    bgmButton.textContent = `BGM: ${bgmEnabled ? "ON" : "OFF"}`;
    bgmButton.setAttribute("aria-pressed", String(bgmEnabled));
}

function playBgmNote() {
    if (!bgmEnabled || gameState !== "playing" || !audioContext) {
        bgmTimer = null;
        return;
    }

    const startTime = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = bgmNotes[bgmNoteIndex];
    volume.gain.setValueAtTime(0.0001, startTime);
    volume.gain.exponentialRampToValueAtTime(0.045, startTime + 0.025);
    volume.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.24);
    oscillator.connect(volume);
    volume.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.25);

    bgmNoteIndex = (bgmNoteIndex + 1) % bgmNotes.length;
    bgmTimer = window.setTimeout(playBgmNote, 280);
}

function startBgm() {
    if (!bgmEnabled || gameState !== "playing" || bgmTimer !== null || bgmStarting || !AudioContextClass) return;
    audioContext ??= new AudioContextClass();
    bgmStarting = true;
    audioContext.resume().then(() => {
        bgmStarting = false;
        if (bgmTimer === null && bgmEnabled && gameState === "playing") playBgmNote();
    }).catch(() => {
        bgmStarting = false;
        bgmEnabled = false;
        updateBgmButton();
        statusText.textContent = "BGMを再生できませんでした。";
    });
}

function stopBgm() {
    if (bgmTimer !== null) window.clearTimeout(bgmTimer);
    bgmTimer = null;
}

function enableBgm() {
    if (!AudioContextClass) return;
    bgmEnabled = true;
    updateBgmButton();
    startBgm();
}

if (!AudioContextClass) {
    bgmButton.disabled = true;
    bgmButton.textContent = "BGM利用不可";
} else {
    updateBgmButton();
}

function resetGame() {
    player = {
        x: 70,
        y: GROUND_Y - 44 * ENTITY_SCALE,
        width: 32 * ENTITY_SCALE,
        height: 44 * ENTITY_SCALE,
        vx: 0,
        vy: 0,
        grounded: true,
    };
    coins = coinPositions.map((coin) => ({ ...coin, collected: false }));
    enemies = enemyPositions.map((enemy) => ({
        ...enemy,
        y: GROUND_Y - 27 * ENTITY_SCALE,
        width: 34 * ENTITY_SCALE,
        height: 26 * ENTITY_SCALE,
        speed: 38,
        direction: 1,
        alive: true,
    }));
    bossBird.x = 1570;
    bossBird.y = 130;
    bossBird.hitCooldown = 0;
    bossBird.previousPhase = 0;
    cameraX = 0;
    bossElapsed = 0;
    gameState = "playing";
    overlay.hidden = true;
    coinCount.textContent = "0";
    statusText.textContent = "準備OK！ゴールを目指そう。";
    input.left = false;
    input.right = false;
    input.jump = false;
    lastTime = 0;
}

function setKey(event, pressed) {
    if (event.target instanceof HTMLButtonElement) return;
    const key = event.key.toLowerCase();
    const handled = ["arrowleft", "arrowright", "arrowup", " ", "a", "d", "w"];
    if (handled.includes(key)) event.preventDefault();
    if (gameState !== "playing") return;

    if (key === "arrowleft" || key === "a") input.left = pressed;
    if (key === "arrowright" || key === "d") input.right = pressed;
    if (key === "arrowup" || key === " " || key === "w") input.jump = pressed;
    if (pressed && handled.includes(key)) enableBgm();
}

window.addEventListener("keydown", (event) => setKey(event, true));
window.addEventListener("keyup", (event) => setKey(event, false));
window.addEventListener("blur", () => {
    input.left = false;
    input.right = false;
    input.jump = false;
});

document.querySelectorAll("[data-control]").forEach((button) => {
    const control = button.dataset.control;
    const release = (event) => {
        event.preventDefault();
        input[control] = false;
    };
    button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        if (gameState === "playing") {
            input[control] = true;
            enableBgm();
        }
        button.setPointerCapture(event.pointerId);
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
});

bgmButton.addEventListener("click", () => {
    if (!AudioContextClass) return;
    bgmEnabled = !bgmEnabled;
    updateBgmButton();
    if (bgmEnabled) startBgm();
    else stopBgm();
});

restartButton.addEventListener("click", () => {
    resetGame();
    startBgm();
});
resetButton.addEventListener("click", () => {
    resetGame();
    startBgm();
});

function intersects(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x
        && a.y < b.y + b.height && a.y + a.height > b.y;
}

function resolvePlatformWallX(entity, previousX, nextX) {
    let resolvedX = nextX;
    for (const platform of platforms) {
        if (entity.y + entity.height <= platform.y || entity.y >= PLATFORM_BOTTOM) continue;
        const platformRight = platform.x + platform.width;
        if (resolvedX >= platformRight || resolvedX + entity.width <= platform.x) continue;

        if (nextX > previousX) {
            resolvedX = platform.x - entity.width;
        } else if (nextX < previousX) {
            resolvedX = platformRight;
        } else {
            const distanceFromLeft = Math.abs(previousX + entity.width - platform.x);
            const distanceFromRight = Math.abs(platformRight - previousX);
            resolvedX = distanceFromLeft <= distanceFromRight
                ? platform.x - entity.width
                : platformRight;
        }
    }
    return Math.max(0, Math.min(WORLD_WIDTH - entity.width, resolvedX));
}

function finish(won) {
    gameState = won ? "won" : "lost";
    stopBgm();
    overlay.hidden = false;
    if (won) {
        overlayEyebrow.textContent = "MISSION COMPLETE";
        overlayTitle.textContent = "ゴール！";
        overlayMessage.textContent = `${coins.filter((coin) => coin.collected).length} 個のコインを集めたよ。お見事！`;
        statusText.textContent = "ステージクリア！";
    } else {
        overlayEyebrow.textContent = "TRY AGAIN";
        overlayTitle.textContent = "あっ！";
        overlayMessage.textContent = "もう一度チャレンジしてみよう。";
        statusText.textContent = "落ちてしまった！もう一度挑戦しよう。";
    }
}

function update(delta) {
    if (gameState !== "playing") return;

    bossElapsed += delta;
    const cyclePhase = bossElapsed % 8;
    const previousPhase = bossBird.previousPhase;
    if (cyclePhase < 4.5) {
        bossBird.y = 130 + Math.sin(bossElapsed * 2) * 8;
    } else if (cyclePhase < 5.3) {
        bossBird.y = 130 + ((cyclePhase - 4.5) / 0.8) * 265;
    } else if (cyclePhase < 6.3) {
        bossBird.y = 395;
    } else if (cyclePhase < 7.1) {
        bossBird.y = 395 - ((cyclePhase - 6.3) / 0.8) * 265;
    } else {
        bossBird.y = 130;
    }
    bossBird.x = 1570 + (Math.sin(bossElapsed * 0.45) + 1) * 270;
    bossBird.hitCooldown = Math.max(0, bossBird.hitCooldown - delta);
    bossBird.previousPhase = cyclePhase;
    if (cyclePhase >= 4.5 && previousPhase < 4.5
        && Math.abs(player.x - bossBird.x) < WIDTH * 0.8) {
        statusText.textContent = "大きな鳥が急降下！ジャンプで避けよう！";
    }

    for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const previousEnemyX = enemy.x;
        const nextEnemyX = enemy.x + enemy.speed * enemy.direction * delta;
        const boundedEnemyX = Math.max(enemy.minX, Math.min(enemy.maxX - enemy.width, nextEnemyX));
        enemy.x = resolvePlatformWallX(enemy, previousEnemyX, boundedEnemyX);
        if (enemy.x !== boundedEnemyX || boundedEnemyX !== nextEnemyX) {
            enemy.direction *= -1;
        }
    }

    const previousBottom = player.y + player.height;
    const previousX = player.x;
    player.vx = (Number(input.right) - Number(input.left)) * RUN_SPEED;
    const nextX = Math.max(0, Math.min(WORLD_WIDTH - player.width, player.x + player.vx * delta));
    player.x = resolvePlatformWallX(player, previousX, nextX);

    if (input.jump && player.grounded) {
        player.vy = -JUMP_SPEED;
        player.grounded = false;
    }

    player.vy += GRAVITY * delta;
    player.y += player.vy * delta;
    player.grounded = false;
    const wasFalling = player.vy > 0;

    for (const platform of platforms) {
        const crossesPlatform = player.x + player.width > platform.x && player.x < platform.x + platform.width;
        const landsOnPlatform = player.vy >= 0 && previousBottom <= platform.y
            && player.y + player.height >= platform.y;
        if (crossesPlatform && landsOnPlatform) {
            player.y = platform.y - player.height;
            player.vy = 0;
            player.grounded = true;
        }
    }

    for (const enemy of enemies) {
        if (!enemy.alive || !intersects(player, enemy)) continue;
        if (wasFalling && previousBottom <= enemy.y + 8) {
            enemy.alive = false;
            player.y = enemy.y - player.height;
            player.vy = -JUMP_SPEED * 0.62;
            player.grounded = false;
            statusText.textContent = "ドローンを撃退！その調子！";
        } else {
            const playerIsLeft = player.x + player.width / 2 < enemy.x + enemy.width / 2;
            player.x = playerIsLeft ? enemy.x - player.width : enemy.x + enemy.width;
            player.x = Math.max(0, Math.min(WORLD_WIDTH - player.width, player.x));
            player.vy = -JUMP_SPEED * 0.42;
            player.grounded = false;
        }
    }
    player.x = resolvePlatformWallX(player, previousX, player.x);

    const birdHitbox = {
        x: bossBird.x + 28 * ENTITY_SCALE,
        y: bossBird.y + 34 * ENTITY_SCALE,
        width: 76 * ENTITY_SCALE,
        height: 36 * ENTITY_SCALE,
    };
    if (bossBird.hitCooldown === 0 && intersects(player, birdHitbox)) {
        player.x += player.x + player.width / 2 < birdHitbox.x + birdHitbox.width / 2 ? -32 : 32;
        player.vy = -JUMP_SPEED * 0.45;
        player.grounded = false;
        bossBird.hitCooldown = 1.2;
        statusText.textContent = "大鳥にぶつかった！体勢を立て直そう！";
    }
    player.x = resolvePlatformWallX(player, previousX, player.x);

    if (player.y > HEIGHT + 90) {
        finish(false);
        return;
    }

    for (const hazard of hazards) {
        if (intersects(player, hazard)) {
            finish(false);
            return;
        }
    }

    for (const coin of coins) {
        if (!coin.collected && intersects(player, { x: coin.x - 11, y: coin.y - 11, width: 22, height: 22 })) {
            coin.collected = true;
            coinCount.textContent = String(coins.filter((item) => item.collected).length);
            statusText.textContent = "コインをゲット！その調子！";
        }
    }

    if (player.x + player.width >= WORLD_WIDTH - 120) finish(true);

    cameraX = Math.max(0, Math.min(WORLD_WIDTH - WIDTH, player.x - WIDTH * 0.35));
}

function drawBackground() {
    const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, "#080f27");
    gradient.addColorStop(0.58, "#172653");
    gradient.addColorStop(1, "#452b68");
    context.fillStyle = gradient;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    const glow = context.createRadialGradient(WIDTH * 0.72, 340, 10, WIDTH * 0.72, 340, 440);
    glow.addColorStop(0, "rgba(44, 224, 220, .2)");
    glow.addColorStop(1, "rgba(44, 224, 220, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    for (const star of stars) {
        const x = star.x - cameraX * 0.22;
        const wrappedX = ((x % (WIDTH + 20)) + WIDTH + 20) % (WIDTH + 20) - 10;
        const twinkle = 0.55 + Math.sin(elapsed * 2 + star.phase) * 0.25;
        context.globalAlpha = twinkle;
        context.fillStyle = "#e2e5ff";
        context.fillRect(wrappedX, star.y, star.size, star.size);
    }
    context.globalAlpha = 1;

    drawSkyline(0.12, 150, 385, 95, "#202d55", "rgba(101, 135, 211, .2)");
    drawSkyline(0.28, 120, 420, 155, "#172246", "rgba(57, 216, 225, .45)");
    drawSkyline(0.48, 96, 455, 205, "#111a38", "rgba(201, 83, 226, .42)");
    drawRain();
}

function drawSkyline(parallax, segmentWidth, baseY, maxHeight, buildingColor, windowColor) {
    const offset = cameraX * parallax;
    const firstSegment = Math.floor(offset / segmentWidth);
    const segmentOffset = offset % segmentWidth;
    const segmentCount = Math.ceil(WIDTH / segmentWidth) + 2;

    for (let position = -1; position < segmentCount; position += 1) {
        const segment = firstSegment + position;
        const seed = ((segment * 37 + 19) % 101 + 101) % 101;
        const width = segmentWidth * (0.58 + (seed % 27) / 100);
        const height = maxHeight * (0.48 + (seed % 49) / 100);
        const x = position * segmentWidth - segmentOffset;
        const top = baseY - height;

        context.fillStyle = buildingColor;
        context.fillRect(x, top, width, HEIGHT - top);
        context.fillStyle = windowColor;
        const columns = Math.max(2, Math.floor(width / 17));
        const rows = Math.floor(height / 22);
        for (let column = 0; column < columns; column += 1) {
            for (let row = 0; row < rows; row += 1) {
                if ((column * 13 + row * 7 + seed) % 5 === 0) continue;
                context.globalAlpha = 0.45 + ((column + row + seed) % 4) * 0.13;
                context.fillRect(x + 8 + column * 15, top + 12 + row * 20, 4, 8);
            }
        }
        context.globalAlpha = 1;
        context.fillStyle = "rgba(58, 224, 230, .55)";
        context.fillRect(x + width * 0.48, top + 4, Math.min(18, width * 0.22), 2);
        if (seed % 4 === 0 && width > 75) {
            const signX = x + width * 0.58;
            const signY = top + 24 + seed % 28;
            context.shadowColor = seed % 8 === 0 ? "#ff4fc8" : "#35f4ee";
            context.shadowBlur = 9;
            context.strokeStyle = seed % 8 === 0 ? "#ff4fc8" : "#35f4ee";
            context.lineWidth = 1;
            context.strokeRect(signX, signY, 22, 13);
            context.shadowBlur = 0;
            context.fillStyle = seed % 8 === 0 ? "#ff9bdf" : "#a4fffb";
            context.font = "7px sans-serif";
            context.fillText("NEON", signX + 2, signY + 9);
        }
    }
}

function drawRain() {
    context.save();
    context.strokeStyle = "rgba(139, 222, 255, .28)";
    context.lineWidth = 1;
    context.beginPath();
    for (const drop of rainDrops) {
        const x = ((drop.x - elapsed * drop.speed * 0.22) % (WIDTH + 24) + WIDTH + 24) % (WIDTH + 24) - 12;
        const y = (drop.y + elapsed * drop.speed) % (HEIGHT + 30) - 15;
        context.moveTo(x, y);
        context.lineTo(x - 3, y + drop.length);
    }
    context.stroke();
    context.restore();
}

function drawPlatform(platform) {
    const x = platform.x - cameraX;
    if (x + platform.width < -20 || x > WIDTH + 20) return;

    context.fillStyle = "#101b32";
    context.fillRect(x, platform.y, platform.width, PLATFORM_BOTTOM - platform.y);
    context.fillStyle = "rgba(35, 67, 94, .8)";
    for (let panelX = x + 12; panelX < x + platform.width - 8; panelX += 36) {
        context.fillRect(panelX, platform.y + 16, 25, PLATFORM_BOTTOM - platform.y - 16);
        context.fillStyle = "rgba(51, 244, 238, .12)";
        context.fillRect(panelX + 3, platform.y + 21, 1, PLATFORM_BOTTOM - platform.y - 27);
        context.fillStyle = "rgba(35, 67, 94, .8)";
    }
    context.shadowColor = "#35f4ee";
    context.shadowBlur = 10;
    context.fillStyle = "#35f4ee";
    context.fillRect(x, platform.y, platform.width, 3);
    context.shadowBlur = 0;
    context.fillStyle = "rgba(255, 79, 200, .75)";
    context.fillRect(x, platform.y + 5, platform.width, 1);
}

function drawHazard(hazard) {
    const x = hazard.x - cameraX;
    if (x + hazard.width < -10 || x > WIDTH + 10) return;
    const teeth = Math.max(1, Math.floor(hazard.width / 16));
    context.shadowColor = "#ff315d";
    context.shadowBlur = 13;
    context.fillStyle = "#ff456d";
    context.beginPath();
    context.moveTo(x, hazard.y + hazard.height);
    for (let index = 0; index < teeth; index += 1) {
        const left = x + (hazard.width / teeth) * index;
        const right = x + (hazard.width / teeth) * (index + 1);
        context.lineTo(left, hazard.y + hazard.height);
        context.lineTo((left + right) / 2, hazard.y + 2);
        context.lineTo(right, hazard.y + hazard.height);
    }
    context.fill();
    context.shadowBlur = 0;
}

function drawEnemy(enemy) {
    if (!enemy.alive) return;
    const x = enemy.x - cameraX;
    if (x + enemy.width < -10 || x > WIDTH + 10) return;
    const width = enemy.width / ENTITY_SCALE;
    const height = enemy.height / ENTITY_SCALE;
    const bob = (Math.sin(elapsed * 4 + enemy.minX) - 1) * 1.5;
    context.save();
    context.translate(x, enemy.y + bob);
    context.scale(ENTITY_SCALE, ENTITY_SCALE);

    context.shadowColor = "#ff4fc8";
    context.shadowBlur = 12;
    context.strokeStyle = "#ff83dc";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(width / 2, 3);
    context.lineTo(width / 2, -2);
    context.stroke();
    context.fillStyle = "#ffd6f1";
    context.beginPath();
    context.arc(enemy.width / 2, -3, 2.5, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;

    const bodyGradient = context.createLinearGradient(0, 2, 0, height);
    bodyGradient.addColorStop(0, "#ff8bd4");
    bodyGradient.addColorStop(1, "#a643a5");
    context.fillStyle = bodyGradient;
    context.beginPath();
    context.roundRect(1, 3, width - 2, height - 3, 10);
    context.fill();
    context.fillStyle = "#321b4b";
    context.beginPath();
    context.ellipse(12, 14, 3, 4, 0, 0, Math.PI * 2);
    context.ellipse(22, 14, 3, 4, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fff0fb";
    context.fillRect(11, 12, 1.5, 1.5);
    context.fillRect(21, 12, 1.5, 1.5);
    context.fillStyle = "#ffcf66";
    context.fillRect(8, height - 3, 5, 3);
    context.fillRect(21, height - 3, 5, 3);
    context.restore();
}

function drawCoin(coin) {
    if (coin.collected) return;
    const x = coin.x - cameraX;
    if (x < -20 || x > WIDTH + 20) return;
    const pulse = 1 + Math.sin(elapsed * 5 + coin.x) * 0.1;
    context.save();
    context.translate(x, coin.y);
    context.scale(pulse, 1);
    context.fillStyle = "#ffd36f";
    context.shadowColor = "#ffd36f";
    context.shadowBlur = 14;
    context.beginPath();
    context.arc(0, 0, 10, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#fff0ad";
    context.lineWidth = 2;
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = "#b88636";
    context.fillRect(-1, -5, 2, 10);
    context.restore();
}

function drawGoal() {
    const x = WORLD_WIDTH - 112 - cameraX;
    if (x < -50 || x > WIDTH + 50) return;
    context.shadowColor = "#35f4ee";
    context.shadowBlur = 12;
    context.fillStyle = "#a9fffb";
    context.fillRect(x, GROUND_Y - 118, 5, 118);
    context.shadowBlur = 0;
    context.fillStyle = "#ff4fc8";
    context.beginPath();
    context.moveTo(x + 5, GROUND_Y - 116);
    context.lineTo(x + 53, GROUND_Y - 99);
    context.lineTo(x + 5, GROUND_Y - 82);
    context.closePath();
    context.fill();
    context.shadowColor = "#ff4fc8";
    context.shadowBlur = 12;
    context.fillStyle = "#f3f4ff";
    context.beginPath();
    context.arc(x + 2.5, GROUND_Y - 121, 6, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
}

function drawPlayer() {
    const x = player.x - cameraX;
    const y = player.y;
    const moving = Math.abs(player.vx) > 0;
    const bob = player.grounded && moving ? (Math.sin(elapsed * 19) - 1) * 2 : 0;
    context.save();
    context.translate(x, y + bob);
    context.scale(ENTITY_SCALE, ENTITY_SCALE);

    const facing = input.left ? -1 : 1;
    context.strokeStyle = "#74f6e0";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(11, 7);
    context.quadraticCurveTo(8, 1, 10, -3);
    context.moveTo(22, 7);
    context.quadraticCurveTo(25, 1, 23, -3);
    context.stroke();
    context.shadowColor = "#35f4ee";
    context.shadowBlur = 13;
    context.fillStyle = "#c7fff2";
    context.beginPath();
    context.arc(10, -3, 2.5, 0, Math.PI * 2);
    context.arc(23, -3, 2.5, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;

    const headGradient = context.createLinearGradient(4, 2, 28, 27);
    headGradient.addColorStop(0, "#b8ffe4");
    headGradient.addColorStop(1, "#48cbbd");
    context.fillStyle = headGradient;
    context.beginPath();
    context.ellipse(16, 14, 14, 13, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#d5fff3";
    context.lineWidth = 1.5;
    context.stroke();

    context.fillStyle = "#122343";
    context.beginPath();
    context.ellipse(facing === 1 ? 20 : 12, 14, 4.1, 6.2, 0, 0, Math.PI * 2);
    context.ellipse(facing === 1 ? 11 : 21, 14, 3.1, 5.2, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#f2fffa";
    context.beginPath();
    context.arc(facing === 1 ? 21 : 13, 12, 1.3, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#188c88";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(16, 20, 2.3, 0.2, Math.PI - 0.2);
    context.stroke();

    const suitGradient = context.createLinearGradient(0, 25, 0, 44);
    suitGradient.addColorStop(0, "#ff4fc8");
    suitGradient.addColorStop(1, "#8b2d9b");
    context.fillStyle = suitGradient;
    context.beginPath();
    context.roundRect(1, 25, 30, 18, 7);
    context.fill();
    context.fillStyle = "#ffb0eb";
    context.fillRect(7, 39, 7, 5);
    context.fillRect(20, 39, 7, 5);
    context.fillStyle = "#70f2df";
    context.beginPath();
    context.roundRect(12, 29, 8, 6, 2);
    context.fill();
    context.fillStyle = "#f4d878";
    context.fillRect(15, 30, 2, 4);
    context.restore();
}

function drawBossBird() {
    const x = bossBird.x - cameraX;
    if (x + bossBird.width < -20 || x > WIDTH + 20) return;

    const facing = Math.cos(bossElapsed * 0.45) >= 0 ? 1 : -1;
    const flap = Math.sin(bossElapsed * 7) * 0.55;
    context.save();
    context.translate(x + bossBird.width / 2, bossBird.y + bossBird.height / 2);
    context.scale(facing * ENTITY_SCALE, ENTITY_SCALE);
    context.shadowColor = "#ff4fc8";
    context.shadowBlur = 18;

    context.save();
    context.translate(-15, -10);
    context.rotate(-0.25 + flap);
    context.fillStyle = "#a643a5";
    context.beginPath();
    context.moveTo(0, 0);
    context.quadraticCurveTo(-36, -8, -68, -42);
    context.quadraticCurveTo(-55, -3, -25, 13);
    context.closePath();
    context.fill();
    context.restore();

    context.fillStyle = "#8b2d9b";
    context.beginPath();
    context.moveTo(-35, 7);
    context.lineTo(-65, -4);
    context.lineTo(-52, 16);
    context.lineTo(-70, 22);
    context.lineTo(-32, 24);
    context.closePath();
    context.fill();

    context.fillStyle = "#ff4fc8";
    context.beginPath();
    context.ellipse(5, 8, 39, 24, -0.08, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(34, -7, 19, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#a643a5";
    context.beginPath();
    context.moveTo(2, -7);
    context.quadraticCurveTo(-15, -29, -3, -42);
    context.quadraticCurveTo(20, -31, 20, -13);
    context.closePath();
    context.fill();

    context.shadowBlur = 0;
    context.fillStyle = "#f4d878";
    context.beginPath();
    context.moveTo(48, -5);
    context.lineTo(69, 1);
    context.lineTo(48, 8);
    context.closePath();
    context.fill();
    context.fillStyle = "#101b32";
    context.beginPath();
    context.arc(39, -11, 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fff";
    context.fillRect(40, -13, 1.5, 1.5);

    context.strokeStyle = "#ffb0eb";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-5, 27);
    context.lineTo(-2, 34);
    context.lineTo(4, 27);
    context.moveTo(16, 27);
    context.lineTo(19, 34);
    context.lineTo(25, 27);
    context.stroke();
    context.restore();

    if (bossBird.y > 190 && bossBird.y < 320) {
        context.fillStyle = "#ff4fc8";
        context.font = "bold 22px sans-serif";
        context.textAlign = "center";
        context.fillText("!", x + bossBird.width / 2, bossBird.y - 12);
    }
}

function draw() {
    drawBackground();
    for (const platform of platforms) drawPlatform(platform);
    for (const hazard of hazards) drawHazard(hazard);
    for (const enemy of enemies) drawEnemy(enemy);
    drawBossBird();
    for (const coin of coins) drawCoin(coin);
    drawGoal();
    drawPlayer();
}

function frame(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const delta = Math.min((timestamp - lastTime) / 1000, 1 / 30);
    lastTime = timestamp;
    elapsed += delta;
    update(delta);
    draw();
    requestAnimationFrame(frame);
}

resetGame();
requestAnimationFrame(frame);
