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
let score = 0;
let running = false;
let animationId;


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

  this.draw = function() {
    ctx.save();
    ctx.translate(this.x + this.width/2, this.y + this.height/2);
    ctx.rotate(this.rotation);
    // Bird body
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
    ctx.restore();
  };

  this.update = function() {
    this.velocity += levels[currentLevel].gravity;
    this.y += this.velocity;

    if (this.velocity < 0) {
      this.rotation = -0.4;
    } else if (this.velocity > 6) {
      this.rotation = 0.6;
    } else {
      this.rotation = 0;
    }
  };

  this.flap = function() {
    this.velocity = -7;
  };
}

// Pipe constructor
function Pipe(x) {
  this.x = x;
  this.topHeight = Math.random() * (height - levels[currentLevel].pipeGap - 120) + 50;
  this.bottomY = this.topHeight + levels[currentLevel].pipeGap;
  this.width = pipeWidth;
  this.passed = false;

  this.draw = function() {
    ctx.fillStyle = '#388e3c';
    // top pipe
    ctx.fillRect(this.x, 0, this.width, this.topHeight);
    // bottom pipe
    ctx.fillRect(this.x, this.bottomY, this.width, height - this.bottomY);
    // caps
    ctx.fillStyle = '#2e7d32';
    ctx.fillRect(this.x - 5, this.topHeight - 12, this.width + 10, 12);
    ctx.fillRect(this.x - 5, this.bottomY, this.width + 10, 12);
  };

  this.update = function() {
    this.x -= levels[currentLevel].pipeSpeed;
  };
}

// Collision detection
function isCollision(bird, pipe) {
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
  score = 0;
  currentLevel = 'easy';
  running = true;
  scoreEl.textContent = score;
  updateLevelDisplay();
  gameOverScreen.classList.remove('show');

  pipes.push(new Pipe(width + 120));
  pipes.push(new Pipe(width + 120 + width / 2));
}

function updateLevelDisplay() {
  levelEl.textContent = currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1);
}

// Increase score and update level if needed
function updateScore() {
  score++;
  scoreEl.textContent = score;

  if (score === 10) {
    currentLevel = 'medium';
    updateLevelDisplay();
  } else if (score === 20) {
    currentLevel = 'hard';
    updateLevelDisplay();
  }
}

// Main game loop
function gameLoop() {
  ctx.clearRect(0, 0, width, height);

  bird.update();
  bird.draw();

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

  window.removeEventListener('keydown', handleInput);
  window.removeEventListener('mousedown', handleInput);
}

// Flap on input
function handleInput(e) {
  if (!running) return;

  if (e.type === 'keydown' && e.code !== 'Space') return;

  bird.flap();
}

restartBtn.addEventListener('click', () => {
  initGame();
  gameLoop();

  window.addEventListener('keydown', handleInput);
  window.addEventListener('mousedown', handleInput);
});

// Start game
initGame();
gameLoop();
window.addEventListener('keydown', handleInput);
window.addEventListener('mousedown', handleInput);
