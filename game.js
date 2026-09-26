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

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
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
    { x: 505, y: GROUND_Y - 28, width: 48, height: 28 },
    { x: 1015, y: GROUND_Y - 28, width: 50, height: 28 },
    { x: 1745, y: GROUND_Y - 28, width: 52, height: 28 },
    { x: 2460, y: GROUND_Y - 28, width: 50, height: 28 },
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

const stars = Array.from({ length: 65 }, (_, index) => ({
    x: (index * 173 + 31) % WORLD_WIDTH,
    y: 24 + ((index * 67) % 270),
    size: index % 7 === 0 ? 2 : 1,
    phase: index * 0.7,
}));

const input = { left: false, right: false, jump: false };
let player;
let coins;
let cameraX = 0;
let elapsed = 0;
let gameState = "playing";
let lastTime = 0;

function resetGame() {
    player = { x: 70, y: GROUND_Y - 44, width: 32, height: 44, vx: 0, vy: 0, grounded: true };
    coins = coinPositions.map((coin) => ({ ...coin, collected: false }));
    cameraX = 0;
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
    const key = event.key.toLowerCase();
    const handled = ["arrowleft", "arrowright", "arrowup", " ", "a", "d", "w"];
    if (handled.includes(key)) event.preventDefault();
    if (gameState !== "playing") return;

    if (key === "arrowleft" || key === "a") input.left = pressed;
    if (key === "arrowright" || key === "d") input.right = pressed;
    if (key === "arrowup" || key === " " || key === "w") input.jump = pressed;
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
        if (gameState === "playing") input[control] = true;
        button.setPointerCapture(event.pointerId);
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
});

restartButton.addEventListener("click", resetGame);
resetButton.addEventListener("click", resetGame);

function intersects(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x
        && a.y < b.y + b.height && a.y + a.height > b.y;
}

function finish(won) {
    gameState = won ? "won" : "lost";
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

    const previousBottom = player.y + player.height;
    player.vx = (Number(input.right) - Number(input.left)) * RUN_SPEED;
    player.x = Math.max(0, Math.min(WORLD_WIDTH - player.width, player.x + player.vx * delta));

    if (input.jump && player.grounded) {
        player.vy = -JUMP_SPEED;
        player.grounded = false;
    }

    player.vy += GRAVITY * delta;
    player.y += player.vy * delta;
    player.grounded = false;

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
    gradient.addColorStop(0, "#18294a");
    gradient.addColorStop(1, "#344878");
    context.fillStyle = gradient;
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

    for (let index = 0; index < 9; index += 1) {
        const x = index * 420 - ((cameraX * 0.12) % 420);
        context.fillStyle = "rgba(105, 119, 177, .16)";
        context.beginPath();
        context.ellipse(x + 130, 400, 190, 90, 0, Math.PI, 0);
        context.fill();
    }
}

function drawPlatform(platform) {
    const x = platform.x - cameraX;
    if (x + platform.width < -20 || x > WIDTH + 20) return;

    context.fillStyle = "#263957";
    context.fillRect(x, platform.y, platform.width, HEIGHT - platform.y + 20);
    context.fillStyle = "#83d7c2";
    context.fillRect(x, platform.y, platform.width, 7);
    context.fillStyle = "rgba(179, 247, 222, .35)";
    context.fillRect(x + 8, platform.y + 11, Math.max(0, platform.width - 16), 2);
}

function drawHazard(hazard) {
    const x = hazard.x - cameraX;
    if (x + hazard.width < -10 || x > WIDTH + 10) return;
    const teeth = Math.max(1, Math.floor(hazard.width / 16));
    context.fillStyle = "#ff718c";
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
    context.beginPath();
    context.arc(0, 0, 10, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#fff0ad";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "#b88636";
    context.fillRect(-1, -5, 2, 10);
    context.restore();
}

function drawGoal() {
    const x = WORLD_WIDTH - 112 - cameraX;
    if (x < -50 || x > WIDTH + 50) return;
    context.fillStyle = "#d9e1f7";
    context.fillRect(x, GROUND_Y - 118, 5, 118);
    context.fillStyle = "#a99aff";
    context.beginPath();
    context.moveTo(x + 5, GROUND_Y - 116);
    context.lineTo(x + 53, GROUND_Y - 99);
    context.lineTo(x + 5, GROUND_Y - 82);
    context.closePath();
    context.fill();
    context.fillStyle = "#f3f4ff";
    context.beginPath();
    context.arc(x + 2.5, GROUND_Y - 121, 6, 0, Math.PI * 2);
    context.fill();
}

function drawPlayer() {
    const x = player.x - cameraX;
    const y = player.y;
    const moving = Math.abs(player.vx) > 0;
    const bob = player.grounded && moving ? Math.sin(elapsed * 19) * 2 : 0;
    context.save();
    context.translate(x, y + bob);

    context.fillStyle = "rgba(10, 15, 32, .2)";
    context.beginPath();
    context.ellipse(player.width / 2, player.height + 3 - bob, 17, 4, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#ffca72";
    context.beginPath();
    context.roundRect(2, 1, 28, 28, 10);
    context.fill();
    context.fillStyle = "#fff0cf";
    context.beginPath();
    context.roundRect(5, 5, 22, 19, 8);
    context.fill();

    const facing = input.left ? -1 : 1;
    context.fillStyle = "#283757";
    context.beginPath();
    context.arc(facing === 1 ? 20 : 12, 15, 2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#f28584";
    context.beginPath();
    context.ellipse(facing === 1 ? 25 : 7, 20, 3, 2, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#8e7aff";
    context.beginPath();
    context.roundRect(1, 25, 30, 18, 7);
    context.fill();
    context.fillStyle = "#7361dd";
    context.fillRect(7, 39, 7, 5);
    context.fillRect(20, 39, 7, 5);
    context.restore();
}

function draw() {
    drawBackground();
    for (const platform of platforms) drawPlatform(platform);
    for (const hazard of hazards) drawHazard(hazard);
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
