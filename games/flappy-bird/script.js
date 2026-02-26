const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreEl = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');

const width = canvas.width;
const height = canvas.height;

const pipeWidth = 60;

const levels = {
  easy: { pipeSpeed: 2, pipeGap: 180, gravity: 0.35 },
  medium: { pipeSpeed: 3, pipeGap: 150, gravity: 0.45 },
  hard: { pipeSpeed: 4, pipeGap: 120, gravity: 0.55 }
};

let currentLevel = 'easy';

let bird;
let pipes = [];
let powerUps = [];
let particles = [];
let score = 0;
let running = false;
let animationId;
let highScore = localStorage.getItem('flappyHighScore') || 0;
let achievements = JSON.parse(localStorage.getItem('flappyAchievements')) || {};
let birdSkin = 'default';
let dayNightCycle = 0;
let backgroundType = 'day';

const levelButtons = document.querySelectorAll('.level-btn');

levelButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    levelButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentLevel = btn.dataset.level;
    updateLevelDisplay();
  });
});
// Bird constructor
function Bird() {
  this.x = 80;
  this.y = height / 2;
  this.width = 40;
  this.height = 30;
  this.velocity = 0;
  this.rotation = 0;
  this.shield = false;
  this.shieldTimer = 0;
  this.magnet = false;
  this.magnetTimer = 0;
  this.slowMotion = false;
  this.slowMotionTimer = 0;

  this.draw = function() {
    ctx.save();
    ctx.translate(this.x + this.width/2, this.y + this.height/2);
    ctx.rotate(this.rotation);
    
    // Draw shield if active
    if (this.shield) {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.width/2 + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw bird based on skin
    this.drawBirdSkin();
    
    ctx.restore();
  };
  
  this.drawBirdSkin = function() {
    const skins = {
      default: () => {
        ctx.fillStyle = '#ffca28';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.width/2, this.height/2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Eye
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(6, -5, 5, 0, Math.PI * 2);
        ctx.fill();
        // Beak
        ctx.fillStyle = '#f57c00';
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(25, -6);
        ctx.lineTo(25, 6);
        ctx.closePath();
        ctx.fill();
      },
      fire: () => {
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.width/2, this.height/2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Flame effect
        ctx.fillStyle = '#ff8800';
        ctx.beginPath();
        ctx.ellipse(-5, 0, this.width/3, this.height/3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Eye
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(6, -5, 5, 0, Math.PI * 2);
        ctx.fill();
      },
      ice: () => {
        ctx.fillStyle = '#88ccff';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.width/2, this.height/2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Ice crystals
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        for(let i = 0; i < 4; i++) {
          const angle = (Math.PI * 2 / 4) * i;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle) * this.width/2, Math.sin(angle) * this.height/2);
          ctx.stroke();
        }
        // Eye
        ctx.fillStyle = '#004488';
        ctx.beginPath();
        ctx.arc(6, -5, 5, 0, Math.PI * 2);
        ctx.fill();
      },
      rainbow: () => {
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.width/2);
        gradient.addColorStop(0, '#ff0000');
        gradient.addColorStop(0.3, '#ff8800');
        gradient.addColorStop(0.6, '#ffff00');
        gradient.addColorStop(1, '#00ff00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.width/2, this.height/2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Eye
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(6, -5, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    
    (skins[birdSkin] || skins.default)();
  };

  this.update = function() {
    const effectiveGravity = this.slowMotion ? levels[currentLevel].gravity * 0.5 : levels[currentLevel].gravity;
    this.velocity += effectiveGravity;
    this.y += this.velocity;

    if (this.velocity < 0) {
      this.rotation = -0.4;
    } else if (this.velocity > 6) {
      this.rotation = 0.6;
    } else {
      this.rotation = 0;
    }
    
    // Update power-up timers
    if (this.shieldTimer > 0) {
      this.shieldTimer--;
      if (this.shieldTimer === 0) this.shield = false;
    }
    
    if (this.magnetTimer > 0) {
      this.magnetTimer--;
      if (this.magnetTimer === 0) this.magnet = false;
    }
    
    if (this.slowMotionTimer > 0) {
      this.slowMotionTimer--;
      if (this.slowMotionTimer === 0) this.slowMotion = false;
    }
  };

  this.flap = function() {
    this.velocity = -7;
    createParticles(this.x + this.width/2, this.y + this.height/2, '#ffca28');
  };
}

// Pipe constructor
function Pipe(x) {
  this.x = x;
  this.topHeight = Math.random() * (height - levels[currentLevel].pipeGap - 120) + 50;
  this.bottomY = this.topHeight + levels[currentLevel].pipeGap;
  this.width = pipeWidth;
  this.passed = false;
  this.moving = Math.random() < 0.2; // 20% chance of moving pipe
  this.moveDirection = Math.random() < 0.5 ? 1 : -1;
  this.moveSpeed = 1;

  this.draw = function() {
    // Moving pipes have different color
    const pipeColor = this.moving ? '#d32f2f' : '#388e3c';
    const capColor = this.moving ? '#b71c1c' : '#2e7d32';
    
    ctx.fillStyle = pipeColor;
    // top pipe
    ctx.fillRect(this.x, 0, this.width, this.topHeight);
    // bottom pipe
    ctx.fillRect(this.x, this.bottomY, this.width, height - this.bottomY);
    // caps
    ctx.fillStyle = capColor;
    ctx.fillRect(this.x - 5, this.topHeight - 12, this.width + 10, 12);
    ctx.fillRect(this.x - 5, this.bottomY, this.width + 10, 12);
    
    // Draw moving indicator
    if (this.moving) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(this.x, 0, this.width, this.topHeight);
      ctx.strokeRect(this.x, this.bottomY, this.width, height - this.bottomY);
      ctx.setLineDash([]);
    }
  };

  this.update = function() {
    const speedMultiplier = bird.slowMotion ? 0.5 : 1;
    this.x -= levels[currentLevel].pipeSpeed * speedMultiplier;
    
    // Moving pipes
    if (this.moving) {
      this.topHeight += this.moveDirection * this.moveSpeed;
      this.bottomY = this.topHeight + levels[currentLevel].pipeGap;
      
      // Reverse direction at boundaries
      if (this.topHeight <= 20 || this.topHeight >= height - levels[currentLevel].pipeGap - 100) {
        this.moveDirection *= -1;
      }
    }
  };
}

// Collision detection
function isCollision(bird, pipe) {
  // Skip collision if bird has shield
  if (bird.shield) return false;
  
  const birdBox = {
    left: bird.x,
    right: bird.x + bird.width,
    top: bird.y,
    bottom: bird.y + bird.height
  };

  const topPipeBox = {
    left: pipe.x,
    right: pipe.x + pipe.width,
    top: 0,
    bottom: pipe.topHeight
  };

  const bottomPipeBox = {
    left: pipe.x,
    right: pipe.x + pipe.width,
    top: pipe.bottomY,
    bottom: height
  };

  const collideTop = !(birdBox.right < topPipeBox.left || birdBox.left > topPipeBox.right || birdBox.bottom < topPipeBox.top || birdBox.top > topPipeBox.bottom);
  const collideBottom = !(birdBox.right < bottomPipeBox.left || birdBox.left > bottomPipeBox.right || birdBox.bottom < bottomPipeBox.top || birdBox.top > bottomPipeBox.bottom);

  return collideTop || collideBottom;
}

// Reset game variables and start fresh
function initGame() {
  bird = new Bird();
  pipes = [];
  powerUps = [];
  particles = [];
  score = 0;
  currentLevel = 'easy';
  running = true;
  scoreEl.textContent = score;
  updateLevelDisplay();
  gameOverScreen.classList.remove('show');

  pipes.push(new Pipe(width + 120));
  pipes.push(new Pipe(width + 120 + width / 2));
  
  // Reset bird power-ups
  bird.shield = false;
  bird.shieldTimer = 0;
  bird.magnet = false;
  bird.magnetTimer = 0;
  bird.slowMotion = false;
  bird.slowMotionTimer = 0;
}

function updateLevelDisplay() {
  levelEl.textContent = currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1);
}

// Increase score and update level if needed
function updateScore() {
  score++;
  scoreEl.textContent = score;
  
  // Check achievements
  checkAchievements();

  if (score === 10) {
    currentLevel = 'medium';
    updateLevelDisplay();
    showMessage('Level Up: Medium!');
  } else if (score === 20) {
    currentLevel = 'hard';
    updateLevelDisplay();
    showMessage('Level Up: Hard!');
  } else if (score === 30) {
    showMessage('Amazing! 30 points!');
  }
}

// Main game loop
function gameLoop() {
  ctx.clearRect(0, 0, width, height);
  
  // Draw background
  drawBackground();
  
  // Update day/night cycle
  dayNightCycle += 0.001;
  if (dayNightCycle > Math.PI * 2) dayNightCycle = 0;
  backgroundType = Math.sin(dayNightCycle) > 0 ? 'day' : 'night';

  bird.update();
  bird.draw();
  
  // Update and draw power-ups
  updatePowerUps();
  
  // Update and draw particles
  updateParticles();

  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].draw();
    pipes[i].update();

    // Collision check
    if (isCollision(bird, pipes[i])) {
      endGame();
      return;
    }

    // Score update
    if (!pipes[i].passed && pipes[i].x + pipeWidth < bird.x) {
      pipes[i].passed = true;
      updateScore();
    }

    // Remove pipes offscreen
    if (pipes[i].x + pipeWidth < 0) {
      pipes.splice(i, 1);
    }
  }

  // Add new pipes smoothly
  if (pipes.length < 4) {
    const lastPipe = pipes[pipes.length - 1];
    if (lastPipe.x < width) {
      pipes.push(new Pipe(width + 120));
    }
  }

  // Bird hits ground or ceiling?
  if (bird.y + bird.height > height || bird.y < 0) {
    endGame();
    return;
  }

  animationId = requestAnimationFrame(gameLoop);
}

// Game over logic
function endGame() {
  running = false;
  cancelAnimationFrame(animationId);
  finalScoreEl.textContent = score;
  gameOverScreen.classList.add('show');
  
  // Update high score
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('flappyHighScore', highScore);
    showMessage('New High Score!');
  }

  window.removeEventListener('keydown', handleInput);
  window.removeEventListener('mousedown', handleInput);
}

// Flap on input
function handleInput(e) {
  if (!running) return;

  if (e.type === 'keydown' && e.code !== 'Space') return;
  
  // Prevent default scrolling
  if (e.type === 'keydown') {
    e.preventDefault();
  }

  bird.flap();
}

restartBtn.addEventListener('click', () => {
  initGame();
  gameLoop();

  window.addEventListener('keydown', handleInput);
  window.addEventListener('mousedown', handleInput);
});

// Power-up functions
function spawnPowerUp() {
  if (powerUps.length < 2 && Math.random() < 0.005) {
    const types = ['shield', 'magnet', 'slowMotion', 'coin'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    powerUps.push({
      x: width + 50,
      y: Math.random() * (height - 100) + 50,
      type: type,
      width: 30,
      height: 30,
      collected: false
    });
  }
}

function updatePowerUps() {
  // Spawn new power-ups
  spawnPowerUp();
  
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const powerUp = powerUps[i];
    
    // Move power-up
    const speedMultiplier = bird.slowMotion ? 0.5 : 1;
    powerUp.x -= levels[currentLevel].pipeSpeed * speedMultiplier;
    
    // Magnet effect
    if (bird.magnet) {
      const dx = bird.x - powerUp.x;
      const dy = bird.y - powerUp.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 100) {
        powerUp.x += dx * 0.05;
        powerUp.y += dy * 0.05;
      }
    }
    
    // Draw power-up
    drawPowerUp(powerUp);
    
    // Check collection
    if (checkPowerUpCollection(bird, powerUp)) {
      collectPowerUp(powerUp);
      powerUps.splice(i, 1);
    }
    
    // Remove off-screen power-ups
    if (powerUp.x + powerUp.width < 0) {
      powerUps.splice(i, 1);
    }
  }
}

function drawPowerUp(powerUp) {
  ctx.save();
  
  const colors = {
    shield: '#00ffff',
    magnet: '#ff00ff',
    slowMotion: '#ffff00',
    coin: '#ffd700'
  };
  
  const symbols = {
    shield: '🛡️',
    magnet: '🧲',
    slowMotion: '⏱️',
    coin: '🪙'
  };
  
  // Draw glowing effect
  ctx.shadowBlur = 15;
  ctx.shadowColor = colors[powerUp.type];
  
  // Draw background circle
  ctx.fillStyle = colors[powerUp.type];
  ctx.beginPath();
  ctx.arc(powerUp.x + powerUp.width/2, powerUp.y + powerUp.height/2, powerUp.width/2, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw symbol
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbols[powerUp.type], powerUp.x + powerUp.width/2, powerUp.y + powerUp.height/2);
  
  ctx.restore();
}

function checkPowerUpCollection(bird, powerUp) {
  return bird.x < powerUp.x + powerUp.width &&
         bird.x + bird.width > powerUp.x &&
         bird.y < powerUp.y + powerUp.height &&
         bird.y + bird.height > powerUp.y;
}

function collectPowerUp(powerUp) {
  createParticles(powerUp.x + powerUp.width/2, powerUp.y + powerUp.height/2, '#ffd700');
  
  switch(powerUp.type) {
    case 'shield':
      bird.shield = true;
      bird.shieldTimer = 300; // 5 seconds at 60fps
      showMessage('Shield Activated!');
      break;
    case 'magnet':
      bird.magnet = true;
      bird.magnetTimer = 300;
      showMessage('Magnet Activated!');
      break;
    case 'slowMotion':
      bird.slowMotion = true;
      bird.slowMotionTimer = 300;
      showMessage('Slow Motion Activated!');
      break;
    case 'coin':
      score += 5;
      scoreEl.textContent = score;
      showMessage('+5 Points!');
      break;
  }
}

// Particle system
function createParticles(x, y, color) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 5,
      life: 30,
      color: color
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life--;
    particle.vy += 0.1; // gravity
    
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = particle.life / 30;
    ctx.fillRect(particle.x, particle.y, 4, 4);
    ctx.globalAlpha = 1;
    
    if (particle.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// Background drawing
function drawBackground() {
  if (backgroundType === 'day') {
    // Day sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#98D8E8');
    ctx.fillStyle = gradient;
  } else {
    // Night sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0c1445');
    gradient.addColorStop(1, '#183059');
    ctx.fillStyle = gradient;
  }
  
  ctx.fillRect(0, 0, width, height);
  
  // Draw clouds/stars
  if (backgroundType === 'day') {
    drawClouds();
  } else {
    drawStars();
  }
}

function drawClouds() {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  // Simple cloud shapes
  ctx.beginPath();
  ctx.arc(100, 50, 20, 0, Math.PI * 2);
  ctx.arc(120, 50, 25, 0, Math.PI * 2);
  ctx.arc(140, 50, 20, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.beginPath();
  ctx.arc(300, 80, 15, 0, Math.PI * 2);
  ctx.arc(315, 80, 20, 0, Math.PI * 2);
  ctx.arc(330, 80, 15, 0, Math.PI * 2);
  ctx.fill();
}

function drawStars() {
  ctx.fillStyle = 'white';
  for (let i = 0; i < 20; i++) {
    const x = (i * 73) % width;
    const y = (i * 37) % (height / 2);
    const size = (i % 3) + 1;
    ctx.fillRect(x, y, size, size);
  }
}

// Achievement system
function checkAchievements() {
  if (score >= 10 && !achievements.firstTen) {
    achievements.firstTen = true;
    showMessage('🏆 Achievement: First 10 Points!');
  }
  
  if (score >= 25 && !achievements.twentyFive) {
    achievements.twentyFive = true;
    showMessage('🏆 Achievement: 25 Points Master!');
  }
  
  if (score >= 50 && !achievements.fifty) {
    achievements.fifty = true;
    showMessage('🏆 Achievement: 50 Points Legend!');
  }
  
  localStorage.setItem('flappyAchievements', JSON.stringify(achievements));
}

// Message system
function showMessage(text) {
  const messageEl = document.createElement('div');
  messageEl.className = 'game-message';
  messageEl.textContent = text;
  messageEl.style.cssText = `
    position: fixed;
    top: 20%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    font-weight: bold;
    z-index: 1000;
    animation: fadeInOut 2s ease;
  `;
  document.body.appendChild(messageEl);
  setTimeout(() => messageEl.remove(), 2000);
}

// Start game
initGame();
gameLoop();
window.addEventListener('keydown', handleInput);
window.addEventListener('mousedown', handleInput);

// Initialize UI elements
document.getElementById('highScoreDisplay').textContent = highScore;

// Bird skin change function
function changeBirdSkin(skin) {
  birdSkin = skin;
  document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.skin === skin);
  });
}

// Update power-up indicators
function updatePowerUpIndicators() {
  const shieldEl = document.getElementById('shieldIndicator');
  const magnetEl = document.getElementById('magnetIndicator');
  const slowMotionEl = document.getElementById('slowMotionIndicator');
  
  shieldEl.classList.toggle('active', bird.shield);
  magnetEl.classList.toggle('active', bird.magnet);
  slowMotionEl.classList.toggle('active', bird.slowMotion);
}

// Add this to the game loop
const originalGameLoop = gameLoop;
gameLoop = function() {
  originalGameLoop();
  updatePowerUpIndicators();
};
