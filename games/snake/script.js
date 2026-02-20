const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const box = 20;
let snake = [], direction;
let food = {}, score = 0, player = 'Player';
let gameInterval;
let difficulty = "easy";
let gameSpeed = 120;
let particles = [];
let highScore = localStorage.getItem("snakeHighScore") || 0;
document.getElementById("highScore").textContent = highScore;

const gameOverMsgs = ["Oops! Lost it!", "Yeh kaisa!", "Try again!", "Better luck next time!"];

document.addEventListener('DOMContentLoaded', () => {
  player = prompt("Enter your name:") || "Player";
  document.getElementById('playerName').textContent = player;
  restartGame();
  document.addEventListener('keydown', changeDirection);
});

function changeDirection(e) {
  const key = e.key;
  if (key === 'ArrowUp' && direction !== 'DOWN') direction = 'UP';
  else if (key === 'ArrowDown' && direction !== 'UP') direction = 'DOWN';
  else if (key === 'ArrowLeft' && direction !== 'RIGHT') direction = 'LEFT';
  else if (key === 'ArrowRight' && direction !== 'LEFT') direction = 'RIGHT';
}

function restartGame() {
  clearInterval(gameInterval);
  snake = [{ x: 200, y: 200 }];
  direction = 'RIGHT';
  score = 0;
  food = randomPosition();
  updateScore();
  hideGameOver();
  gameInterval = setInterval(gameLoop, gameSpeed);
}

function randomPosition() {
  return {
    x: Math.floor(Math.random() * (canvas.width / box)) * box,
    y: Math.floor(Math.random() * (canvas.height / box)) * box
  };
}

function updateScore() {
  document.getElementById('scoreBoard').textContent = `Score: ${score}`;
}

function drawSnakeSegment(seg, isHead=false) {
  ctx.shadowBlur = 15;
  ctx.shadowColor = "#00ff88";
  ctx.fillStyle = isHead ? "#00ff88" : "#00cc66";
  ctx.fillRect(seg.x, seg.y, box, box);
  ctx.shadowBlur = 0;
}

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'red';
  ctx.fillRect(food.x, food.y, box, box);

  let head = { ...snake[0] };
  if (direction === 'UP') head.y -= box;
  if (direction === 'DOWN') head.y += box;
  if (direction === 'LEFT') head.x -= box;
  if (direction === 'RIGHT') head.x += box;

  if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height
      || snake.some(s => s.x === head.x && s.y === head.y)) {
    return endGame();
  }

  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    score++;
	updateScore();
	document.getElementById("eatSound").play();
	createParticles(food.x, food.y);
	food = randomPosition();
  } else {
    snake.pop();
  }

  snake.forEach((seg, idx) => drawSnakeSegment(seg, idx === 0));
}

function endGame() {
  clearInterval(gameInterval);
  const msg = gameOverMsgs[Math.floor(Math.random() * gameOverMsgs.length)];
  document.getElementById('gameOverMsg').textContent = msg;
  document.getElementById('finalScore').textContent = score;
  document.getElementById('gameOver').classList.add('show');
}

function hideGameOver() {
  document.getElementById('gameOver').classList.remove('show');
}

function setDifficulty(level) {

  difficulty = level;

  if (level === "easy") gameSpeed = 140;
  if (level === "medium") gameSpeed = 100;
  if (level === "hard") gameSpeed = 70;

  document.querySelectorAll('.difficulty-switch button')
    .forEach(btn => btn.classList.remove('active'));

  document
    .querySelector(`.difficulty-switch button[onclick="setDifficulty('${level}')"]`)
    .classList.add('active');

  restartGame();
}
function createParticles(x, y) {
  for (let i = 0; i < 15; i++) {
    particles.push({
      x: x,
      y: y,
      dx: (Math.random() - 0.5) * 4,
      dy: (Math.random() - 0.5) * 4,
      life: 20
    });
  }
}

function drawParticles() {
  particles.forEach((p, index) => {
    ctx.fillStyle = "#ff3b7d";
    ctx.fillRect(p.x, p.y, 4, 4);
    p.x += p.dx;
    p.y += p.dy;
    p.life--;
    if (p.life <= 0) particles.splice(index, 1);
  });
}