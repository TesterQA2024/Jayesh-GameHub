let board = Array(9).fill(null);
let currentPlayer = "X";
let mode = "pvp";
let gameOver = false;
let difficulty = "easy"; // default level
let isPlayerTurn = true;
let scoreX = 0;
let scoreO = 0;
let powerUps = {
  X: { wildCard: 0, blockCell: 0, doubleTurn: 0 },
  O: { wildCard: 0, blockCell: 0, doubleTurn: 0 }
};
let selectedPowerUp = null;
let blockedCells = new Set();
let theme = 'neon';

document.addEventListener('DOMContentLoaded', () => {
  player = prompt("Enter your name:") || "Player";
  document.getElementById('playerName').textContent = player;
  restartGame();
  document.addEventListener('keydown', changeDirection);
  document.addEventListener('keydown', handlePause);
  
  // Initialize power-up display
  updatePowerUpDisplay();
  
  // Add keyboard scrolling prevention
  document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
  });
});

const boardDiv = document.getElementById("board");

function setMode(selectedMode) {
  mode = selectedMode;

  // Remove active from all
  document.querySelectorAll('.mode-switch button')
    .forEach(btn => btn.classList.remove('active'));

  // Add active to selected
  document
    .querySelector(`.mode-switch button[onclick="setMode('${selectedMode}')"]`)
    .classList.add('active');

  restartGame();
}

function restartGame() {
  board = Array(9).fill(null);
  currentPlayer = "X";
  gameOver = false;
  isPlayerTurn = true;
  blockedCells.clear();
  selectedPowerUp = null;
  document.getElementById("status").textContent = "";
  boardDiv.innerHTML = "";

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("div");
    cell.classList.add("cell");
    cell.dataset.index = i;
    cell.addEventListener("click", handleClick);
    boardDiv.appendChild(cell);
  }

  document.getElementById("popup").classList.add("hidden");
  updatePowerUpDisplay();
}

function handleClick(e) {
  const index = e.target.dataset.index;

  // Fix: Only skip if cell is not null (i.e., already filled)
  if (board[index] !== null || gameOver || !isPlayerTurn) return;
  
  // Check if cell is blocked
  if (blockedCells.has(index)) {
    showMessage('This cell is blocked!');
    return;
  }

  if (mode === "pvp") {
    makeMove(index, currentPlayer);
    if (!gameOver) {
      isPlayerTurn = false;
      setTimeout(() => {
        currentPlayer = currentPlayer === "X" ? "O" : "X";
        isPlayerTurn = true;
      }, 100);
    }
  } else if (mode === "pvc") {
    makeMove(index, "X");
    isPlayerTurn = false;

    if (!gameOver) {
      setTimeout(() => {
        computerMove();
        isPlayerTurn = true;
      }, 500);
    }
  }
}


function makeMove(index, player) {
  let actualPlayer = player;
  let displaySymbol = player;
  
  // Check for wild card power-up
  if (selectedPowerUp === 'wildCard' && powerUps[player].wildCard > 0) {
    displaySymbol = 'W';
    powerUps[player].wildCard--;
    selectedPowerUp = null;
    updatePowerUpDisplay();
    showMessage(`Wild Card activated! ${player} gets 2 points!`);
  }
  
  board[index] = actualPlayer;
  const cell = document.querySelector(`.cell[data-index="${index}"]`);
  cell.textContent = displaySymbol;
  
  // Add animation
  cell.classList.add('cell-pop');
  setTimeout(() => cell.classList.remove('cell-pop'), 300);

  if (checkWinner(player)) {
    showPopup(player);
    gameOver = true;
  } else if (!board.includes(null)) {
    showPopup("Draw");
    gameOver = true;
  }
}

function computerMove() {
  // First, try to use power-ups strategically
  if (difficulty === "hard" && Math.random() < 0.3) {
    useComputerPowerUp();
  }
  
  if (difficulty === "easy") {
    randomMove();
  } else if (difficulty === "medium") {
    smartMove();  // Try win/block
  } else if (difficulty === "hard") {
    let bestIndex = getBestMove();  // Minimax
    makeMove(bestIndex, "O");
  }
}

function checkWinner(player) {
  const wins = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];
  return wins.some(pattern => pattern.every(i => board[i] === player));
}

// 🎉 Celebration Popup & Confetti
function showPopup(winner) {
  const popup = document.getElementById("popup");
  const winnerName = document.getElementById("winnerName");

  winnerName.textContent = winner === "Draw" ? "It’s a Draw!" : `${winner} Wins!`;

  // ⭐ SCORE UPDATE PART
  if (winner === "X") {
    scoreX += 2; // Bonus points
    document.getElementById("scoreX").textContent = scoreX;
  }

  if (winner === "O") {
    scoreO += 2; // Bonus points
    document.getElementById("scoreO").textContent = scoreO;
  }
  
  // Award power-ups for winning
  if (winner !== "Draw") {
    awardPowerUps(winner);
  }

  popup.classList.add("show");

  startConfetti();      
   

  setTimeout(() => {
    popup.classList.remove("show");
    restartGame();
  }, 2500);
}

// 🎊 Confetti
function startConfetti() {
  const canvas = document.getElementById("confettiCanvas");
  const confettiInstance = confetti.create(canvas, { resize: true, useWorker: true });
  confettiInstance({
    particleCount: 150,
    spread: 80,
    origin: { y: 0.6 }
  });
}



function setLevel(level) {
  difficulty = level;

  // Remove active from all level buttons
  document.querySelectorAll('.level-switch button')
    .forEach(btn => btn.classList.remove('active'));

  // Add active to selected level
  document
    .querySelector(`.level-switch button[onclick="setLevel('${level}')"]`)
    .classList.add('active');
}

function randomMove() {
  let empty = board.map((v, i) => v === null ? i : null).filter(i => i !== null);
  let index = empty[Math.floor(Math.random() * empty.length)];
  makeMove(index, "O");
}

function smartMove() {
  // Try to win
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = "O";
      if (checkWinner("O")) {
        makeMove(i, "O");
        return;
      }
      board[i] = null;
    }
  }

  // Try to block
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = "X";
      if (checkWinner("X")) {
        board[i] = null;
        makeMove(i, "O");
        return;
      }
      board[i] = null;
    }
  }

  // Else random
  randomMove();
}

function getBestMove() {
  let bestScore = -Infinity;
  let move;

  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = "O";
      let score = minimax(board, 0, false);
      board[i] = null;
      if (score > bestScore) {
        bestScore = score;
        move = i;
      }
    }
  }
  return move;
}

function minimax(newBoard, depth, isMaximizing) {
  if (checkWinner("O")) return 10 - depth;
  if (checkWinner("X")) return depth - 10;
  if (!newBoard.includes(null)) return 0;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (newBoard[i] === null) {
        newBoard[i] = "O";
        let score = minimax(newBoard, depth + 1, false);
        newBoard[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (newBoard[i] === null) {
        newBoard[i] = "X";
        let score = minimax(newBoard, depth + 1, true);
        newBoard[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
}

// Power-up functions
function awardPowerUps(player) {
  const randomPowerUp = ['wildCard', 'blockCell', 'doubleTurn'][Math.floor(Math.random() * 3)];
  powerUps[player][randomPowerUp]++;
  showMessage(`${player} earned a ${randomPowerUp} power-up!`);
  updatePowerUpDisplay();
}

function selectPowerUp(type) {
  if (powerUps[currentPlayer][type] > 0) {
    selectedPowerUp = selectedPowerUp === type ? null : type;
    updatePowerUpDisplay();
  }
}

function usePowerUp(type, index) {
  if (powerUps[currentPlayer][type] <= 0) return;
  
  switch(type) {
    case 'blockCell':
      blockedCells.add(index);
      powerUps[currentPlayer].blockCell--;
      showMessage('Cell blocked for 1 turn!');
      setTimeout(() => blockedCells.delete(index), 2000);
      break;
    case 'doubleTurn':
      // Skip player switch for next turn
      powerUps[currentPlayer].doubleTurn--;
      showMessage('Double turn activated!');
      break;
  }
  updatePowerUpDisplay();
}

function useComputerPowerUp() {
  const availablePowerUps = Object.keys(powerUps.O).filter(key => powerUps.O[key] > 0);
  if (availablePowerUps.length === 0) return;
  
  const powerUp = availablePowerUps[Math.floor(Math.random() * availablePowerUps.length)];
  
  if (powerUp === 'blockCell') {
    const emptyCells = board.map((v, i) => v === null ? i : null).filter(i => i !== null);
    if (emptyCells.length > 0) {
      const randomIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      blockedCells.add(randomIndex);
      powerUps.O.blockCell--;
      setTimeout(() => blockedCells.delete(randomIndex), 2000);
    }
  }
}

function updatePowerUpDisplay() {
  const playerPowerUps = powerUps[currentPlayer];
  document.querySelectorAll('.power-up-btn').forEach(btn => {
    const type = btn.dataset.powerup;
    const count = playerPowerUps[type] || 0;
    btn.textContent = `${getPowerUpSymbol(type)} (${count})`;
    btn.classList.toggle('active', selectedPowerUp === type);
    btn.disabled = count === 0;
  });
}

function getPowerUpSymbol(type) {
  const symbols = {
    wildCard: '🃏',
    blockCell: '🚫',
    doubleTurn: '🔄'
  };
  return symbols[type] || type;
}

function showMessage(text) {
  const messageEl = document.createElement('div');
  messageEl.className = 'game-message';
  messageEl.textContent = text;
  messageEl.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 15px 25px;
    border-radius: 10px;
    font-weight: bold;
    z-index: 1000;
    animation: fadeInOut 2s ease;
  `;
  document.body.appendChild(messageEl);
  setTimeout(() => messageEl.remove(), 2000);
}

function changeTheme(newTheme) {
  theme = newTheme;
  document.body.className = `game-page theme-${theme}`;
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

// Add cell visual updates for blocked cells
function updateBlockedCells() {
  document.querySelectorAll('.cell').forEach((cell, index) => {
    cell.classList.toggle('blocked-cell', blockedCells.has(index));
  });
}

// Update blocked cells display periodically
setInterval(updateBlockedCells, 100);
