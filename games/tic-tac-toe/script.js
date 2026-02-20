let board = Array(9).fill(null);
let currentPlayer = "X";
let mode = "pvp";
let gameOver = false;
let difficulty = "easy"; // default level
let isPlayerTurn = true;
let scoreX = 0;
let scoreO = 0;

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
}

function handleClick(e) {
  const index = e.target.dataset.index;

  // Fix: Only skip if cell is not null (i.e., already filled)
  if (board[index] !== null || gameOver || !isPlayerTurn) return;

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
  board[index] = player;
  document.querySelector(`.cell[data-index="${index}"]`).textContent = player;

  if (checkWinner(player)) {
    showPopup(player);
    gameOver = true;
  } else if (!board.includes(null)) {
    showPopup("Draw");
    gameOver = true;
  }
}

function computerMove() {
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
    scoreX++;
    document.getElementById("scoreX").textContent = scoreX;
  }

  if (winner === "O") {
    scoreO++;
    document.getElementById("scoreO").textContent = scoreO;
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
