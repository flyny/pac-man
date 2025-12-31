// hero.js — TIMER (60s) -> LEVEL UP -> MORE/HARDER ENEMIES
console.log("hero.js loaded");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Viewport size
canvas.width = 512;
canvas.height = 320;

const TILE_SIZE = 32;

// Tiles
// 0 grass (walkable)
// 1 trees (blocked)
// 2 water (blocked)
// 3 stone (walkable)
function isWalkable(tile) {
    return tile === 0 || tile === 3;
}

// ---------- MAP ----------
function makeJungleMap(cols, rows) {
    const m = Array.from({ length: rows }, () => Array(cols).fill(0));
    const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

    // Borders
    for (let r = 0; r < rows; r++) {
        m[r][0] = 1;
        m[r][cols - 1] = 1;
    }
    for (let c = 0; c < cols; c++) {
        m[0][c] = 1;
        m[rows - 1][c] = 1;
    }

    // Water blobs
    for (let i = 0; i < Math.floor((cols * rows) / 250); i++) {
        const cx = randInt(2, cols - 3);
        const cy = randInt(2, rows - 3);
        const radius = randInt(1, 3);
        for (let r = cy - radius; r <= cy + radius; r++) {
            for (let c = cx - radius; c <= cx + radius; c++) {
                if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
                    if (Math.random() < 0.7) m[r][c] = 2;
                }
            }
        }
    }

    // Tree clusters
    for (let i = 0; i < Math.floor((cols * rows) / 180); i++) {
        const cx = randInt(2, cols - 3);
        const cy = randInt(2, rows - 3);
        const radius = randInt(1, 2);
        for (let r = cy - radius; r <= cy + radius; r++) {
            for (let c = cx - radius; c <= cx + radius; c++) {
                if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
                    if (Math.random() < 0.55 && m[r][c] === 0) m[r][c] = 1;
                }
            }
        }
    }

    // Stone patches
    for (let i = 0; i < Math.floor((cols * rows) / 500); i++) {
        const cx = randInt(2, cols - 3);
        const cy = randInt(2, rows - 3);
        for (let r = cy - 1; r <= cy + 1; r++) {
            for (let c = cx - 2; c <= cx + 2; c++) {
                if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
                    if (m[r][c] === 0 && Math.random() < 0.8) m[r][c] = 3;
                }
            }
        }
    }

    // Clear spawn area
    for (let r = 2; r <= 10; r++) for (let c = 2; c <= 10; c++) m[r][c] = 0;

    return m;
}

const map = makeJungleMap(120, 80);
const WORLD_WIDTH = map[0].length * TILE_SIZE;
const WORLD_HEIGHT = map.length * TILE_SIZE;

// ---------- Utility ----------
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
function getTileAt(px, py) {
    const col = Math.floor(px / TILE_SIZE);
    const row = Math.floor(py / TILE_SIZE);
    return map[row]?.[col];
}
function tryMoveEntity(ent, dx, dy) {
    // X
    let nx = clamp(ent.x + dx, 0, WORLD_WIDTH - 1);
    let ny = ent.y;
    if (isWalkable(getTileAt(nx, ny))) ent.x = nx;

    // Y
    nx = ent.x;
    ny = clamp(ent.y + dy, 0, WORLD_HEIGHT - 1);
    if (isWalkable(getTileAt(nx, ny))) ent.y = ny;
}

// ---------- Player ----------
const player = {
    x: 4 * TILE_SIZE,
    y: 4 * TILE_SIZE,
    size: 20,

    speed: 2,
    baseSpeed: 2,
    speedBoostFrames: 0,

    hp: 100,
    maxHp: 100,
    invulnFrames: 0,

    facing: "down",
    attackFrames: 0,
    attackCooldown: 0
};

// ---------- Camera ----------
const camera = { x: 0, y: 0 };
function updateCamera() {
    const targetX = player.x - canvas.width / 2;
    const targetY = player.y - canvas.height / 2;

    const SMOOTH = 0.15;
    camera.x += (targetX - camera.x) * SMOOTH;
    camera.y += (targetY - camera.y) * SMOOTH;

    camera.x = clamp(camera.x, 0, WORLD_WIDTH - canvas.width);
    camera.y = clamp(camera.y, 0, WORLD_HEIGHT - canvas.height);
}

// ---------- Input ----------
const keys = {};
let attackRequested = false;

document.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    if (e.key === " ") attackRequested = true;
});
document.addEventListener("keyup", (e) => (keys[e.key] = false));
// ----- Mobile on-screen controls -----
(function setupMobileControls() {
    const controls = document.getElementById("mobile-controls");
    if (!controls) return;

    // Helper to press/release a key
    function setKey(key, isDown) {
        keys[key] = isDown;
    }

    // D-pad buttons: hold to keep moving
    controls.querySelectorAll("[data-key]").forEach((btn) => {
        const key = btn.getAttribute("data-key");

        const down = (e) => {
            e.preventDefault();
            setKey(key, true);
        };
        const up = (e) => {
            e.preventDefault();
            setKey(key, false);
        };

        // Pointer events work for mouse + touch
        btn.addEventListener("pointerdown", down);
        btn.addEventListener("pointerup", up);
        btn.addEventListener("pointercancel", up);
        btn.addEventListener("pointerleave", up);
    });

    // Attack button: tap to attack
    const attackBtn = document.getElementById("attackBtn");
    if (attackBtn) {
        attackBtn.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            attackRequested = true;  // uses your existing attack flow
        });
    }
})();

// ---------- Viewport-only Tiles ----------
function setTileColor(tile) {
    if (tile === 0) ctx.fillStyle = "#2ecc71";
    else if (tile === 1) ctx.fillStyle = "#145a32";
    else if (tile === 2) ctx.fillStyle = "#3498db";
    else if (tile === 3) ctx.fillStyle = "#7f8c8d";
    else ctx.fillStyle = "#000";
}
function drawMapViewportOnly() {
    const buffer = 1;
    const startCol = Math.max(0, Math.floor(camera.x / TILE_SIZE) - buffer);
    const endCol = Math.min(map[0].length - 1, Math.floor((camera.x + canvas.width) / TILE_SIZE) + buffer);
    const startRow = Math.max(0, Math.floor(camera.y / TILE_SIZE) - buffer);
    const endRow = Math.min(map.length - 1, Math.floor((camera.y + canvas.height) / TILE_SIZE) + buffer);

    for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
            setTileColor(map[r][c]);
            ctx.fillRect(c * TILE_SIZE - camera.x, r * TILE_SIZE - camera.y, TILE_SIZE, TILE_SIZE);
        }
    }
}

// ---------- Loot ----------
const loot = [];
const LOOT_COUNT = 20;

function spawnLoot(typeOverride = null, xOverride = null, yOverride = null) {
    for (let tries = 0; tries < 300; tries++) {
        const c = randInt(1, map[0].length - 2);
        const r = randInt(1, map.length - 2);
        const t = map[r][c];
        if (!(t === 0 || t === 3)) continue;

        const x = xOverride ?? (c * TILE_SIZE + TILE_SIZE / 2);
        const y = yOverride ?? (r * TILE_SIZE + TILE_SIZE / 2);

        if (dist(x, y, player.x, player.y) < 6 * TILE_SIZE) continue;

        const roll = Math.random();
        let type = typeOverride ?? "heal";
        if (!typeOverride) {
            if (roll > 0.78) type = "speed";
            else if (roll > 0.60) type = "maxhp";
            else type = "heal";
        }

        loot.push({
            x, y,
            size: 14,
            type,
            amount: type === "heal" ? 20 : type === "maxhp" ? 10 : 0
        });
        return;
    }
}

for (let i = 0; i < LOOT_COUNT; i++) spawnLoot();

function applyLoot(item) {
    if (item.type === "heal") {
        player.hp = Math.min(player.maxHp, player.hp + item.amount);
    } else if (item.type === "maxhp") {
        player.maxHp += item.amount;
        player.hp = Math.min(player.maxHp, player.hp + item.amount);
    } else if (item.type === "speed") {
        player.speedBoostFrames = 60 * 4;
    }
}

function updateLootEffects() {
    if (player.speedBoostFrames > 0) {
        player.speedBoostFrames--;
        player.speed = player.baseSpeed + 1.5;
    } else {
        player.speed = player.baseSpeed;
    }
}

function handleLootPickup() {
    const pwx = player.x + (TILE_SIZE - player.size) / 2;
    const pwy = player.y + (TILE_SIZE - player.size) / 2;

    for (let i = loot.length - 1; i >= 0; i--) {
        const l = loot[i];
        const lwx = l.x + (TILE_SIZE - l.size) / 2;
        const lwy = l.y + (TILE_SIZE - l.size) / 2;

        if (aabb(pwx, pwy, player.size, player.size, lwx, lwy, l.size, l.size)) {
            applyLoot(l);
            loot.splice(i, 1);
            spawnLoot(); // respawn
        }
    }
}

// ---------- Enemies + Difficulty Scaling ----------
const enemies = [];

// Base stats scale with level
let level = 1;
let score = 0;

// Current enemies per level (you can tweak)
function enemiesToAddOnLevelUp(lv) {
    const value = Math.floor(3 * Math.pow(1.35, lv - 1));
    return clamp(value, 3, 70);
}

function enemyStatsForLevel(lv) {
    // Grows each level
    return {
        hp: 25 + lv * 8,
        speed: 1.05 + lv * 0.06,
        damage: 8 + lv * 2,
        aggroRadius: (6 + lv * 0.4) * TILE_SIZE
    };
}
function updatePlayerSpeedForLevel(lv) {
    const enemy = enemyStatsForLevel(lv);

    const BASE_PLAYER_SPEED = 2.0;   // your original player speed
    const ENEMY_BASE_SPEED = 1.05;   // enemy speed at lv 0
    const CORRELATION = 0.55;         // player gets 55% of enemy growth

    const enemyGrowth = enemy.speed - ENEMY_BASE_SPEED;

    player.baseSpeed = BASE_PLAYER_SPEED + enemyGrowth * CORRELATION;
}

function spawnEnemy() {
    const stats = enemyStatsForLevel(level);

    for (let tries = 0; tries < 400; tries++) {
        const c = randInt(1, map[0].length - 2);
        const r = randInt(1, map.length - 2);
        const t = map[r][c];
        if (!(t === 0 || t === 3)) continue;

        const x = c * TILE_SIZE + TILE_SIZE / 2;
        const y = r * TILE_SIZE + TILE_SIZE / 2;

        if (dist(x, y, player.x, player.y) < 10 * TILE_SIZE) continue;

        enemies.push({
            x, y,
            size: 18,
            hp: stats.hp,
            maxHp: stats.hp,
            speed: stats.speed,
            damage: stats.damage,
            aggroRadius: stats.aggroRadius,

            // AI
            dirX: 0,
            dirY: 0,
            wanderTimer: 0,

            // knockback
            knockbackFrames: 0,
            kbVX: 0,
            kbVY: 0
        });
        return;
    }
}

function initialEnemySpawn(count) {
    for (let i = 0; i < count; i++) spawnEnemy();
}

initialEnemySpawn(10);

function updateEnemies() {
    for (const e of enemies) {
        if (e.knockbackFrames > 0) {
            e.knockbackFrames--;
            tryMoveEntity(e, e.kbVX, e.kbVY);
            continue;
        }

        const d = dist(e.x, e.y, player.x, player.y);

        if (d <= e.aggroRadius) {
            const vx = (player.x - e.x) / (d || 1);
            const vy = (player.y - e.y) / (d || 1);
            tryMoveEntity(e, vx * e.speed, vy * e.speed);
        } else {
            e.wanderTimer--;
            if (e.wanderTimer <= 0) {
                const dirs = [
                    { x: 1, y: 0 }, { x: -1, y: 0 },
                    { x: 0, y: 1 }, { x: 0, y: -1 },
                    { x: 0, y: 0 }
                ];
                const pick = dirs[randInt(0, dirs.length - 1)];
                e.dirX = pick.x;
                e.dirY = pick.y;
                e.wanderTimer = randInt(30, 90);
            }
            tryMoveEntity(e, e.dirX * e.speed, e.dirY * e.speed);
        }
    }
}

function handleEnemyContactDamage() {
    if (player.invulnFrames > 0) return;

    const pwx = player.x + (TILE_SIZE - player.size) / 2;
    const pwy = player.y + (TILE_SIZE - player.size) / 2;

    for (const e of enemies) {
        const ewx = e.x + (TILE_SIZE - e.size) / 2;
        const ewy = e.y + (TILE_SIZE - e.size) / 2;

        if (aabb(pwx, pwy, player.size, player.size, ewx, ewy, e.size, e.size)) {
            player.hp = Math.max(0, player.hp - e.damage);
            player.invulnFrames = 45;
            break;
        }
    }
}

// ---------- Attack ----------
function startAttack() {
    if (player.attackCooldown > 0) return;
    player.attackFrames = 12;
    player.attackCooldown = 20;
}

function updateAttack() {
    if (attackRequested) {
        startAttack();
        attackRequested = false;
    }
    if (player.attackFrames > 0) player.attackFrames--;
    if (player.attackCooldown > 0) player.attackCooldown--;
}

function getSwordHitbox() {
    const pCenterX = player.x + TILE_SIZE / 2;
    const pCenterY = player.y + TILE_SIZE / 2;

    const w = 18, h = 18, reach = 22;
    let x = pCenterX - w / 2;
    let y = pCenterY - h / 2;

    if (player.facing === "up") y -= reach;
    if (player.facing === "down") y += reach;
    if (player.facing === "left") x -= reach;
    if (player.facing === "right") x += reach;

    return { x, y, w, h };
}

function handleSwordHits() {
    if (player.attackFrames <= 0) return;

    const hb = getSwordHitbox();

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const ewx = e.x + (TILE_SIZE - e.size) / 2;
        const ewy = e.y + (TILE_SIZE - e.size) / 2;

        if (aabb(hb.x, hb.y, hb.w, hb.h, ewx, ewy, e.size, e.size)) {
            e.hp -= 15;

            // knockback
            const d = dist(e.x, e.y, player.x, player.y) || 1;
            e.kbVX = ((e.x - player.x) / d) * 3.2;
            e.kbVY = ((e.y - player.y) / d) * 3.2;
            e.knockbackFrames = 8;

            if (e.hp <= 0) {
                // drop loot sometimes
                if (Math.random() < 0.55) {
                    const dropType = Math.random() < 0.15 ? "maxhp" : (Math.random() < 0.30 ? "speed" : "heal");
                    spawnLoot(dropType, e.x, e.y);
                }
                enemies.splice(i, 1);
                score += scoreForKill(e);
            }
        }
    }
}

// ---------- Player update ----------
function updatePlayer() {
    let dx = 0, dy = 0;

    // Direction input (unit vectors)
    if (keys.ArrowUp) {
        dy -= 1;
        player.facing = "up";
    }
    if (keys.ArrowDown) {
        dy += 1;
        player.facing = "down";
    }
    if (keys.ArrowLeft) {
        dx -= 1;
        player.facing = "left";
    }
    if (keys.ArrowRight) {
        dx += 1;
        player.facing = "right";
    }

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
        const inv = 1 / Math.sqrt(2); // ≈ 0.707
        dx *= inv;
        dy *= inv;
    }

    // Apply speed AFTER normalization
    dx *= player.speed;
    dy *= player.speed;

    tryMoveEntity(player, dx, dy);

    if (player.invulnFrames > 0) player.invulnFrames--;
}

// ---------- TIMER + LEVEL SYSTEM ----------
let timeLeft = 30.0;               // seconds
let lastTs = performance.now();    // for accurate dt
let levelUpFlashFrames = 0;

function formatTime(s) {
    const sec = Math.max(0, Math.ceil(s));
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
}

function levelUp() {
    level++;
    updatePlayerSpeedForLevel(level);
    timeLeft = 30.0;
    levelUpFlashFrames = 60; // 1 second flash

    score += level * 500; // survival bonus

    const add = enemiesToAddOnLevelUp(level);
    for (let i = 0; i < add; i++) spawnEnemy();

    // Optional: tiny reward on level up
    player.hp = Math.min(player.maxHp, player.hp + 10);
}

// ---------- Draw HUD ----------
function drawHPBar() {
    const x = 10, y = 10, w = 220, h = 16;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

    ctx.fillStyle = "#333";
    ctx.fillRect(x, y, w, h);

    const pct = clamp(player.hp / player.maxHp, 0, 1);
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(x, y, Math.floor(w * pct), h);

    ctx.fillStyle = "#fff";
    ctx.font = "12px Arial";
    ctx.fillText(`HP: ${player.hp}/${player.maxHp}`, x + 6, y + 12);
}

function drawLevelAndTimer() {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(10, 34, 290, 24);

    ctx.fillStyle = "#fff";
    ctx.font = "12px Arial";
    ctx.fillText(`Level: ${level}`, 16, 50);
    ctx.fillText(`Time: ${formatTime(timeLeft)}`, 100, 50);

    //ctx.fillText(`Enemies: ${enemies.length}`, 16, 68);
    ctx.fillText(`Score: ${score}`, 220, 50);

    if (player.speedBoostFrames > 0) {
        ctx.fillText(`Speed: ${Math.ceil(player.speedBoostFrames / 60)}s`, 140, 68);
    }

    // Level-up flash
    if (levelUpFlashFrames > 0) {
        levelUpFlashFrames--;
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#000";
        ctx.font = "26px Arial";
        ctx.fillText(`LEVEL ${level}!`, canvas.width / 2 - 70, canvas.height / 2);
    }
}

function drawControlsHint() {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(10, canvas.height - 28, 410, 20);
    ctx.fillStyle = "#fff";
    ctx.font = "12px Arial";
    ctx.fillText("Move: Arrows | Attack: Space | Loot: pink/heal, orange/maxHP, cyan/speed", 16, canvas.height - 14);
}

// Entities
function drawPlayer() {
    const flashing = player.invulnFrames > 0 && Math.floor(player.invulnFrames / 5) % 2 === 0;
    if (flashing) return;

    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(
        player.x - camera.x + (TILE_SIZE - player.size) / 2,
        player.y - camera.y + (TILE_SIZE - player.size) / 2,
        player.size,
        player.size
    );
}

function drawEnemies() {
    for (const e of enemies) {
        const d = dist(e.x, e.y, player.x, player.y);
        ctx.fillStyle = d <= e.aggroRadius ? "#c0392b" : "#8e44ad";

        ctx.fillRect(
            e.x - camera.x + (TILE_SIZE - e.size) / 2,
            e.y - camera.y + (TILE_SIZE - e.size) / 2,
            e.size,
            e.size
        );

        // tiny HP bar
        const barW = 18;
        const pct = clamp(e.hp / e.maxHp, 0, 1);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(e.x - camera.x + 7, e.y - camera.y + 2, barW, 4);
        ctx.fillStyle = "#2ecc71";
        ctx.fillRect(e.x - camera.x + 7, e.y - camera.y + 2, Math.floor(barW * pct), 4);
    }
}

function drawLoot() {
    for (const l of loot) {
        if (l.type === "heal") ctx.fillStyle = "#ff66aa";
        if (l.type === "maxhp") ctx.fillStyle = "#f39c12";
        if (l.type === "speed") ctx.fillStyle = "#00ffff";

        ctx.fillRect(
            l.x - camera.x + (TILE_SIZE - l.size) / 2,
            l.y - camera.y + (TILE_SIZE - l.size) / 2,
            l.size,
            l.size
        );
    }
}

function drawSword() {
    if (player.attackFrames <= 0) return;
    const hb = getSwordHitbox();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(hb.x - camera.x, hb.y - camera.y, hb.w, hb.h);
}

function drawGameOver() {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "28px Arial";
    ctx.fillText("GAME OVER", canvas.width / 2 - 85, canvas.height / 2);
    ctx.font = "14px Arial";
    ctx.fillText("Refresh to restart", canvas.width / 2 - 55, canvas.height / 2 + 26);
}
function scoreForKill(e) {
    // Base points
    let pts = 25;

    // Harder enemies = more points
    pts += Math.floor(e.maxHp * 2);                 // tankier = more
    pts += Math.floor((e.damage - 8) * 15);         // more damage = more
    pts += Math.floor((e.speed - 1.0) * 200);       // faster = more
    pts += Math.floor((e.aggroRadius / TILE_SIZE - 6) * 20); // bigger aggro = more

    // Scale a bit by level, so late-game kills matter
    pts = Math.floor(pts * (1 + (level - 1) * 0.08));

    return Math.max(50, pts);
}


// ---------- MAIN LOOP ----------
function loop(ts) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (player.hp <= 0) {
        drawGameOver();
        return;
    }

    // dt-based timer (more accurate than assuming 60fps)
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    timeLeft -= dt;
    if (timeLeft <= 0) levelUp();

    updateLootEffects();
    updateAttack();
    updatePlayer();
    updateEnemies();

    handleSwordHits();
    handleEnemyContactDamage();
    handleLootPickup();

    updateCamera();

    drawMapViewportOnly();
    drawLoot();
    drawEnemies();
    drawPlayer();
    drawSword();

    drawHPBar();
    drawLevelAndTimer();
    drawControlsHint();

    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
