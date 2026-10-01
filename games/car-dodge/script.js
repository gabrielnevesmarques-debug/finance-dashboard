const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const finalScoreElement = document.getElementById("finalScore");
const highScoreElement = document.getElementById("highScore");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

const road = {
  x: 45,
  width: 310,
  laneWidth: 103.33
};

const player = {
  width: 42,
  height: 72,
  x: 179,
  y: 500,
  speed: 6
};

let enemies = [];
let score = 0;
let highScore = Number(localStorage.getItem("carDodgeHighScore")) || 0;
let gameRunning = false;
let animationId;
let spawnTimer = 0;
let roadOffset = 0;
let lastTime = 0;
let keys = {};

highScoreElement.textContent = highScore;

function resetGame() {
  enemies = [];
  score = 0;
  spawnTimer = 0;
  roadOffset = 0;
  player.x = road.x + road.laneWidth + (road.laneWidth - player.width) / 2;
  scoreElement.textContent = score;
}

function startGame() {
  resetGame();
  gameRunning = true;
  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  lastTime = performance.now();
  animationId = requestAnimationFrame(gameLoop);
}

function endGame() {
  gameRunning = false;
  cancelAnimationFrame(animationId);

  if (score > highScore) {
    highScore = score;
    localStorage.setItem("carDodgeHighScore", highScore);
  }

  finalScoreElement.textContent = score;
  highScoreElement.textContent = highScore;
  gameOverScreen.classList.remove("hidden");
}

function spawnEnemy() {
  const lane = Math.floor(Math.random() * 3);

  enemies.push({
    width: 42,
    height: 72,
    x: road.x + lane * road.laneWidth + (road.laneWidth - 42) / 2,
    y: -90,
    speed: 3.5 + Math.min(score * 0.04, 3)
  });
}

function update(delta) {
  const direction =
    (keys.ArrowRight || keys.d ? 1 : 0) -
    (keys.ArrowLeft || keys.a ? 1 : 0);

  player.x += direction * player.speed * delta * 60;

  const minX = road.x + 8;
  const maxX = road.x + road.width - player.width - 8;

  player.x = Math.max(minX, Math.min(player.x, maxX));

  roadOffset = (roadOffset + 5 * delta * 60) % 80;

  spawnTimer += delta;
  const spawnInterval = Math.max(0.55, 1.15 - score * 0.01);

  if (spawnTimer >= spawnInterval) {
    spawnEnemy();
    spawnTimer = 0;
  }

  enemies.forEach((enemy) => {
    enemy.y += enemy.speed * delta * 60;
  });

  enemies = enemies.filter((enemy) => {
    if (enemy.y > canvas.height) {
      score += 1;
      scoreElement.textContent = score;
      return false;
    }

    return true;
  });

  if (enemies.some(isColliding)) {
    endGame();
  }
}

function isColliding(enemy) {
  const padding = 7;

  return (
    player.x + padding < enemy.x + enemy.width - padding &&
    player.x + player.width - padding > enemy.x + padding &&
    player.y + padding < enemy.y + enemy.height - padding &&
    player.y + player.height - padding > enemy.y + padding
  );
}

function drawRoad() {
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#334155";
  ctx.fillRect(road.x, 0, road.width, canvas.height);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(road.x, 0, 5, canvas.height);
  ctx.fillRect(road.x + road.width - 5, 0, 5, canvas.height);

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 4;
  ctx.setLineDash([34, 26]);

  for (let i = 1; i < 3; i += 1) {
    const lineX = road.x + i * road.laneWidth;
    ctx.beginPath();
    ctx.moveTo(lineX, -80 + roadOffset);
    ctx.lineTo(lineX, canvas.height);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

function drawCar(car, bodyColor, windowColor) {
  ctx.fillStyle = bodyColor;
  roundRect(car.x, car.y, car.width, car.height, 8);

  ctx.fillStyle = windowColor;
  roundRect(car.x + 7, car.y + 12, car.width - 14, 22, 5);

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(car.x - 4, car.y + 12, 5, 17);
  ctx.fillRect(car.x + car.width - 1, car.y + 12, 5, 17);
  ctx.fillRect(car.x - 4, car.y + car.height - 29, 5, 17);
  ctx.fillRect(car.x + car.width - 1, car.y + car.height - 29, 5, 17);

  ctx.fillStyle = "#fde68a";
  ctx.fillRect(car.x + 7, car.y + 4, 9, 5);
  ctx.fillRect(car.x + car.width - 16, car.y + 4, 9, 5);
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function draw() {
  drawRoad();

  enemies.forEach((enemy, index) => {
    const colors = ["#ef4444", "#f97316", "#a855f7"];
    drawCar(enemy, colors[index % colors.length], "#172033");
  });

  drawCar(player, "#38bdf8", "#e0f2fe");
}

function gameLoop(timestamp) {
  if (!gameRunning) {
    return;
  }

  const delta = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  update(delta);
  draw();

  if (gameRunning) {
    animationId = requestAnimationFrame(gameLoop);
  }
}

window.addEventListener("keydown", (event) => {
  keys[event.key] = true;

  if (["ArrowLeft", "ArrowRight", "a", "d"].includes(event.key)) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.key] = false;
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

draw();