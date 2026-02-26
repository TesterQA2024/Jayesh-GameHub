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
let powerUps = [];
let activePowerUp = null;
let powerUpTimer = 0;
let isPaused = false;
let level = 1;
let achievements = JSON.parse(localStorage.getItem("snakeAchievements")) || {};
document.getElementById("highScore").textContent = highScore;

const gameOverMsgs = ["Oops! Lost it!", "Yeh kaisa!", "Try again!", "Better luck next time!"];
const powerUpTypes = {
  golden: { color: '#FFD700', points: 5, duration: 0, effect: 'speed' },
  rainbow: { color: '#FF00FF', points: 3, duration: 5000, effect: 'invincible' },
  ghost: { color: '#00FFFF', points: 2, duration: 0, effect: 'ghost' },
  shrink: { color: '#FF1493', points: 1, duration: 0, effect: 'shrink' }
};

document.addEventListener('DOMContentLoaded', () => {
  player = prompt("Enter your name:") || "Player";
  document.getElementById('playerName').textContent = player;
  restartGame();
  document.addEventListener('keydown', changeDirection);
  document.addEventListener('keydown', handlePause);
});

function changeDirection(e) {
  if (isPaused) return;
  
  // Prevent default arrow key behavior (scrolling)
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'p', 'P'].includes(e.key)) {
    e.preventDefault();
  }
  
  const key = e.key;
  if (key === 'ArrowUp' && direction !== 'DOWN') direction = 'UP';
  else if (key === 'ArrowDown' && direction !== 'UP') direction = 'DOWN';
  else if (key === 'ArrowLeft' && direction !== 'RIGHT') direction = 'LEFT';
  else if (key === 'ArrowRight' && direction !== 'LEFT') direction = 'RIGHT';
}

function handlePause(e) {
  if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
    togglePause();
  }
}

function togglePause() {
  isPaused = !isPaused;
  if (isPaused) {
    clearInterval(gameInterval);
    showPauseOverlay();
  } else {
    hidePauseOverlay();
    gameInterval = setInterval(gameLoop, gameSpeed);
  }
}

function showPauseOverlay() {
  const overlay = document.getElementById('pauseOverlay');
  if (!overlay) {
    const pauseDiv = document.createElement('div');
    pauseDiv.id = 'pauseOverlay';
    pauseDiv.className = 'overlay show';
    pauseDiv.innerHTML = `
      <div class="overlay-content">
        <h2>⏸️ Game Paused</h2>
        <p>Press SPACE or P to resume</p>
        <button class="btn" onclick="togglePause()">Resume</button>
      </div>
    `;
    document.querySelector('.game-wrapper').appendChild(pauseDiv);
  }
}

function hidePauseOverlay() {
  const overlay = document.getElementById('pauseOverlay');
  if (overlay) overlay.remove();
}

// 📱 Mobile Swipe Control
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener("touchstart", function(e) {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener("pointerdown", function(e) {

  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  const headX = snake[0].x + box / 2;
  const headY = snake[0].y + box / 2;

  const dx = clickX - headX;
  const dy = clickY - headY;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0 && direction !== "LEFT") {
      direction = "RIGHT";
    } else if (dx < 0 && direction !== "RIGHT") {
      direction = "LEFT";
    }
  } else {
    if (dy > 0 && direction !== "UP") {
      direction = "DOWN";
    } else if (dy < 0 && direction !== "DOWN") {
      direction = "UP";
    }
  }

});

canvas.addEventListener("touchend", function(e) {

  let touchEndX = e.changedTouches[0].clientX;
  let touchEndY = e.changedTouches[0].clientY;

  let dx = touchEndX - touchStartX;
  let dy = touchEndY - touchStartY;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal swipe
    if (dx > 0 && direction !== "LEFT") direction = "RIGHT";
    if (dx < 0 && direction !== "RIGHT") direction = "LEFT";
  } else {
    // Vertical swipe
    if (dy > 0 && direction !== "UP") direction = "DOWN";
    if (dy < 0 && direction !== "DOWN") direction = "UP";
  }

}, { passive: true });

function restartGame() {
  clearInterval(gameInterval);
  snake = [{ x: 200, y: 200 }];
  direction = 'RIGHT';
  score = 0;
  food = randomPosition();
  powerUps = [];
  activePowerUp = null;
  powerUpTimer = 0;
  isPaused = false;
  updateScore();
  hideGameOver();
  hidePauseOverlay();
  checkLevelProgression();
  gameInterval = setInterval(gameLoop, gameSpeed);
}

function randomPosition() {
  return {
    x: Math.floor(Math.random() * (canvas.width / box)) * box,
    y: Math.floor(Math.random() * (canvas.height / box)) * box
  };
}

function spawnPowerUp() {
  if (powerUps.length < 2 && Math.random() < 0.01) {
    const types = Object.keys(powerUpTypes);
    const type = types[Math.floor(Math.random() * types.length)];
    powerUps.push({
      ...randomPosition(),
      type: type,
      ...powerUpTypes[type]
    });
  }
}

function activatePowerUp(powerUp) {
  activePowerUp = powerUp;
  powerUpTimer = powerUp.duration;
  
  switch(powerUp.effect) {
    case 'speed':
      gameSpeed = Math.max(50, gameSpeed - 20);
      clearInterval(gameInterval);
      gameInterval = setInterval(gameLoop, gameSpeed);
      break;
    case 'shrink':
      if (snake.length > 3) {
        snake.pop();
        snake.pop();
      }
      break;
  }
  
  showPowerUpNotification(powerUp);
}

function showPowerUpNotification(powerUp) {
  const notification = document.createElement('div');
  notification.className = 'power-up-notification';
  notification.textContent = `${powerUp.type.toUpperCase()} Power-Up Activated!`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${powerUp.color};
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    font-weight: bold;
    z-index: 1000;
    animation: slideDown 0.5s ease;
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2000);
}

function updatePowerUp() {
  if (powerUpTimer > 0) {
    powerUpTimer -= gameSpeed;
    if (powerUpTimer <= 0) {
      if (activePowerUp && activePowerUp.effect === 'speed') {
        gameSpeed = difficulty === 'easy' ? 140 : difficulty === 'medium' ? 100 : 70;
        clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, gameSpeed);
      }
      activePowerUp = null;
    }
  }
}

function checkLevelProgression() {
  const newLevel = Math.floor(score / 10) + 1;
  if (newLevel > level) {
    level = newLevel;
    showLevelUpNotification();
    checkAchievements();
  }
}

function showLevelUpNotification() {
  const notification = document.createElement('div');
  notification.className = 'level-up-notification';
  notification.textContent = `🎉 LEVEL ${level} UNLOCKED!`;
  notification.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(45deg, #FFD700, #FFA500);
    color: white;
    padding: 20px 40px;
    border-radius: 15px;
    font-size: 24px;
    font-weight: bold;
    z-index: 1000;
    animation: pulse 1s ease;
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2000);
}

function checkAchievements() {
  if (score >= 50 && !achievements.survivor) {
    achievements.survivor = true;
    showAchievement('🏆 SURVIVOR', 'Reached 50 points!');
  }
  if (difficulty === 'hard' && score >= 20 && !achievements.speedDemon) {
    achievements.speedDemon = true;
    showAchievement('🏆 SPEED DEMON', 'Score 20 in Hard Mode!');
  }
  localStorage.setItem("snakeAchievements", JSON.stringify(achievements));
}

function showAchievement(title, description) {
  const achievement = document.createElement('div');
  achievement.className = 'achievement-popup';
  achievement.innerHTML = `
    <div>
      <h3>${title}</h3>
      <p>${description}</p>
    </div>
  `;
  achievement.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: linear-gradient(45deg, #FF6B6B, #4ECDC4);
    color: white;
    padding: 15px 20px;
    border-radius: 10px;
    max-width: 250px;
    z-index: 1000;
    animation: slideInRight 0.5s ease;
  `;
  document.body.appendChild(achievement);
  setTimeout(() => achievement.remove(), 3000);
}

function updateScore() {
  document.getElementById('scoreBoard').textContent = `Score: ${score}`;
  document.getElementById('levelDisplay').textContent = level;
}

function updatePowerUpStatus() {
  const statusEl = document.getElementById('powerUpStatus');
  const textEl = document.getElementById('powerUpText');
  
  if (activePowerUp) {
    statusEl.style.display = 'block';
    textEl.textContent = `${activePowerUp.type.toUpperCase()} Power-Up Active!`;
    statusEl.style.background = `linear-gradient(45deg, ${activePowerUp.color}, ${activePowerUp.color}88)`;
  } else {
    statusEl.style.display = 'none';
  }
}

function drawSnakeSegment(seg, isHead=false) {
  ctx.shadowBlur = 15;
  ctx.shadowColor = activePowerUp && activePowerUp.effect === 'invincible' ? '#FF00FF' : "#00ff88";
  ctx.fillStyle = isHead ? (activePowerUp && activePowerUp.effect === 'invincible' ? '#FF00FF' : "#00ff88") : (activePowerUp && activePowerUp.effect === 'invincible' ? '#CC00CC' : "#00cc66");
  
  // Smooth animation
  const segSize = box - 2;
  ctx.fillRect(seg.x + 1, seg.y + 1, segSize, segSize);
  
  // Draw eyes on head
  if (isHead) {
    ctx.fillStyle = 'white';
    ctx.shadowBlur = 0;
    const eyeSize = 3;
    if (direction === 'RIGHT') {
      ctx.fillRect(seg.x + box - 8, seg.y + 5, eyeSize, eyeSize);
      ctx.fillRect(seg.x + box - 8, seg.y + box - 8, eyeSize, eyeSize);
    } else if (direction === 'LEFT') {
      ctx.fillRect(seg.x + 5, seg.y + 5, eyeSize, eyeSize);
      ctx.fillRect(seg.x + 5, seg.y + box - 8, eyeSize, eyeSize);
    } else if (direction === 'UP') {
      ctx.fillRect(seg.x + 5, seg.y + 5, eyeSize, eyeSize);
      ctx.fillRect(seg.x + box - 8, seg.y + 5, eyeSize, eyeSize);
    } else if (direction === 'DOWN') {
      ctx.fillRect(seg.x + 5, seg.y + box - 8, eyeSize, eyeSize);
      ctx.fillRect(seg.x + box - 8, seg.y + box - 8, eyeSize, eyeSize);
    }
  }
  ctx.shadowBlur = 0;
}

function gameLoop() {
  if (isPaused) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw grid background
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i < canvas.width; i += box) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
  }
  for (let i = 0; i < canvas.height; i += box) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }

  // Draw food with animation
  const time = Date.now() / 1000;
  const pulse = Math.sin(time * 5) * 2;
  ctx.fillStyle = 'red';
  ctx.shadowBlur = 10 + pulse;
  ctx.shadowColor = 'red';
  ctx.fillRect(food.x + 2, food.y + 2, box - 4, box - 4);
  ctx.shadowBlur = 0;
  
  // Draw power-ups
  powerUps.forEach((powerUp, index) => {
    ctx.fillStyle = powerUp.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = powerUp.color;
    ctx.fillRect(powerUp.x + 1, powerUp.y + 1, box - 2, box - 2);
    
    // Draw power-up symbol
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const symbols = { golden: '★', rainbow: '◉', ghost: '👻', shrink: '↓' };
    ctx.fillText(symbols[powerUp.type], powerUp.x + box/2, powerUp.y + box/2);
    ctx.shadowBlur = 0;
  });

  let head = { ...snake[0] };
  if (direction === 'UP') head.y -= box;
  if (direction === 'DOWN') head.y += box;
  if (direction === 'LEFT') head.x -= box;
  if (direction === 'RIGHT') head.x += box;

  // Check wall collision (unless ghost power-up is active)
  if (activePowerUp && activePowerUp.effect === 'ghost') {
    if (head.x < 0) head.x = canvas.width - box;
    if (head.x >= canvas.width) head.x = 0;
    if (head.y < 0) head.y = canvas.height - box;
    if (head.y >= canvas.height) head.y = 0;
  } else {
    if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height) {
      return endGame();
    }
  }
  
  // Check self collision (unless invincible)
  if (!(activePowerUp && activePowerUp.effect === 'invincible') &&
      snake.some(s => s.x === head.x && s.y === head.y)) {
    return endGame();
  }

  snake.unshift(head);
  
  // Check food collision
  if (head.x === food.x && head.y === food.y) {
    score += (activePowerUp && activePowerUp.points) ? activePowerUp.points : 1;
    updateScore();
    document.getElementById("eatSound").play();
    createParticles(food.x, food.y);
    food = randomPosition();
    spawnPowerUp();
    checkLevelProgression();
  } else {
    snake.pop();
  }
  
  // Check power-up collision
  powerUps.forEach((powerUp, index) => {
    if (head.x === powerUp.x && head.y === powerUp.y) {
      score += powerUp.points;
      updateScore();
      createParticles(powerUp.x, powerUp.y, powerUp.color);
      activatePowerUp(powerUp);
      powerUps.splice(index, 1);
    }
  });

  snake.forEach((seg, idx) => drawSnakeSegment(seg, idx === 0));
  drawParticles();
  updatePowerUp();
  updatePowerUpStatus();
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

function createParticles(x, y, color = '#ff3b7d') {
  for (let i = 0; i < 20; i++) {
    particles.push({
      x: x + box/2,
      y: y + box/2,
      dx: (Math.random() - 0.5) * 6,
      dy: (Math.random() - 0.5) * 6,
      life: 30,
      color: color
    });
  }
}

function drawParticles() {
  particles.forEach((p, index) => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life / 30;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    ctx.globalAlpha = 1;
    p.x += p.dx;
    p.y += p.dy;
    p.dx *= 0.95;
    p.dy *= 0.95;
    p.life--;
    if (p.life <= 0) particles.splice(index, 1);
  });
}