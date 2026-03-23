/* ===== Muscle 2048 - game.js ===== */
(() => {
  'use strict';

  // ===== Constants =====
  const SIZE = 4;
  const MAX_UNDOS = 3;

  const LEVELS = [
    { level: 1,  rarity: 'N',      label: 'N',     img: 'images/img9.png',  cls: 'rarity-N',       points: 2 },
    { level: 2,  rarity: 'N+',     label: 'N+',    img: 'images/img10.png', cls: 'rarity-Nplus',   points: 4 },
    { level: 3,  rarity: 'R',      label: 'R',     img: 'images/img8.png',  cls: 'rarity-R',       points: 8 },
    { level: 4,  rarity: 'R+',     label: 'R+',    img: 'images/img7.png',  cls: 'rarity-Rplus',   points: 16 },
    { level: 5,  rarity: 'SR',     label: 'SR',    img: 'images/img6.png',  cls: 'rarity-SR',      points: 32 },
    { level: 6,  rarity: 'SR+',    label: 'SR+',   img: 'images/img5.png',  cls: 'rarity-SRplus',  points: 64 },
    { level: 7,  rarity: 'SSR',    label: 'SSR',   img: 'images/img4.png',  cls: 'rarity-SSR',     points: 128 },
    { level: 8,  rarity: 'SSR+',   label: 'SSR+',  img: 'images/img3.png',  cls: 'rarity-SSRplus', points: 256 },
    { level: 9,  rarity: 'UR',     label: 'UR',    img: 'images/img2.png',  cls: 'rarity-UR',      points: 512 },
    { level: 10, rarity: 'LEGEND', label: 'LEGEND',img: 'images/img1.png',  cls: 'rarity-LEGEND',  points: 1024 },
    { level: 11, rarity: 'GOD',    label: 'GOD',   img: 'images/img1.png',  cls: 'rarity-GOD',     points: 2048 },
  ];

  // ===== State =====
  let grid = [];       // 4x4 array of level (0 = empty, 1-11 = tile level)
  let score = 0;
  let bestScore = parseInt(localStorage.getItem('muscle2048_best') || '0');
  let undosLeft = MAX_UNDOS;
  let prevState = null; // { grid, score } for undo
  let gameOver = false;
  let maxRarityReached = 1;
  let soundEnabled = true;
  let tileIdCounter = 0;
  let tileMap = [];    // 4x4 array of tile IDs for DOM tracking
  let isMoving = false;

  // ===== DOM =====
  const gridEl = document.getElementById('grid');
  const scoreEl = document.getElementById('score');
  const bestScoreEl = document.getElementById('best-score');
  const maxRarityEl = document.getElementById('max-rarity');
  const undoCountEl = document.getElementById('undo-count');
  const overlayEl = document.getElementById('overlay-gameover');
  const finalScoreEl = document.getElementById('final-score');
  const finalRarityEl = document.getElementById('final-rarity');

  // ===== Audio (Web Audio API) =====
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playMergeSound() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch(e) {}
  }

  function playLevelUpFanfare(level) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = level >= 10 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.3);
      });
    } catch(e) {}
  }

  // ===== Grid helpers =====
  function emptyGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }
  function emptyIdGrid() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  }
  function cloneGrid(g) {
    return g.map(r => [...r]);
  }
  function emptyCells() {
    const cells = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] === 0) cells.push([r, c]);
    return cells;
  }

  // ===== Tile position =====
  function tilePosition(r, c) {
    const gap = 8;
    const cellSize = gridEl.querySelector('.cell-bg').offsetWidth;
    const x = gap + c * (cellSize + gap);
    const y = gap + r * (cellSize + gap);
    return { x, y, cellSize };
  }

  // ===== Render =====
  function clearTiles() {
    gridEl.querySelectorAll('.tile').forEach(t => t.remove());
  }

  function createTileEl(r, c, level, id, animClass) {
    const info = LEVELS[level - 1];
    const { x, y } = tilePosition(r, c);
    const el = document.createElement('div');
    el.className = `tile ${info.cls}${animClass ? ' ' + animClass : ''}`;
    el.dataset.id = id;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.innerHTML = `<img src="${info.img}" alt="${info.rarity}" loading="eager"><span class="rarity-badge">${info.label}</span>`;
    gridEl.appendChild(el);
    return el;
  }

  function renderFull() {
    clearTiles();
    tileMap = emptyIdGrid();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] > 0) {
          const id = ++tileIdCounter;
          tileMap[r][c] = id;
          createTileEl(r, c, grid[r][c], id, '');
        }
      }
    }
    updateScoreUI();
  }

  function updateScoreUI() {
    scoreEl.textContent = score;
    bestScoreEl.textContent = bestScore;
    const info = LEVELS[maxRarityReached - 1];
    maxRarityEl.textContent = info ? info.label : 'N';
    undoCountEl.textContent = undosLeft;
  }

  // ===== Spawn tile =====
  function spawnTile() {
    const empty = emptyCells();
    if (empty.length === 0) return;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    // 90% level 1, 10% level 2
    grid[r][c] = Math.random() < 0.9 ? 1 : 2;
    const id = ++tileIdCounter;
    tileMap[r][c] = id;
    createTileEl(r, c, grid[r][c], id, 'tile-new');
  }

  // ===== Move logic =====
  function move(dir) {
    if (gameOver || isMoving) return false;

    // Save state for undo
    const savedGrid = cloneGrid(grid);
    const savedScore = score;

    let moved = false;
    let mergedPositions = [];
    let highestMerge = 0;

    // We process row by row or col by col
    // dir: 0=up, 1=right, 2=down, 3=left
    const newGrid = emptyGrid();
    const mergeMap = []; // track merges for animation

    for (let i = 0; i < SIZE; i++) {
      // Extract line
      let line = [];
      for (let j = 0; j < SIZE; j++) {
        let r, c;
        if (dir === 0) { r = j; c = i; }       // up: column top to bottom
        else if (dir === 1) { r = i; c = SIZE - 1 - j; } // right: row right to left
        else if (dir === 2) { r = SIZE - 1 - j; c = i; } // down: column bottom to top
        else { r = i; c = j; }                  // left: row left to right
        if (grid[r][c] > 0) line.push(grid[r][c]);
      }

      // Merge
      let merged = [];
      let mergedFlags = [];
      for (let k = 0; k < line.length; k++) {
        if (k + 1 < line.length && line[k] === line[k + 1] && line[k] < LEVELS.length) {
          const newLevel = line[k] + 1;
          merged.push(newLevel);
          mergedFlags.push(true);
          score += LEVELS[newLevel - 1].points;
          if (newLevel > highestMerge) highestMerge = newLevel;
          if (newLevel > maxRarityReached) maxRarityReached = newLevel;
          k++; // skip next
        } else {
          merged.push(line[k]);
          mergedFlags.push(false);
        }
      }

      // Place back
      for (let j = 0; j < SIZE; j++) {
        let r, c;
        if (dir === 0) { r = j; c = i; }
        else if (dir === 1) { r = i; c = SIZE - 1 - j; }
        else if (dir === 2) { r = SIZE - 1 - j; c = i; }
        else { r = i; c = j; }
        if (j < merged.length) {
          newGrid[r][c] = merged[j];
          if (mergedFlags[j]) mergedPositions.push([r, c]);
        }
      }
    }

    // Check if anything changed
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (grid[r][c] !== newGrid[r][c]) moved = true;

    if (!moved) return false;

    // Save undo state
    prevState = { grid: savedGrid, score: savedScore, maxRarity: maxRarityReached };

    grid = newGrid;

    // Update best score
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('muscle2048_best', bestScore.toString());
    }

    // Animate
    isMoving = true;
    renderFull();

    // Add merge animation
    mergedPositions.forEach(([r, c]) => {
      const id = tileMap[r][c];
      const el = gridEl.querySelector(`.tile[data-id="${id}"]`);
      if (el) el.classList.add('tile-merge');
    });

    // Sound
    if (mergedPositions.length > 0) {
      playMergeSound();
      if (highestMerge >= 7) {
        // SSR+ level up fanfare
        playLevelUpFanfare(highestMerge);
        showLevelUpToast(highestMerge);
      }
    }

    // Spawn new tile after short delay
    setTimeout(() => {
      spawnTile();
      updateScoreUI();
      isMoving = false;

      // Check game over
      if (isGameOver()) {
        gameOver = true;
        showGameOver();
      }
    }, 140);

    return true;
  }

  // ===== Game Over check =====
  function isGameOver() {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) return false;
        if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return false;
        if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return false;
      }
    return true;
  }

  function showGameOver() {
    finalScoreEl.textContent = score;
    finalRarityEl.textContent = LEVELS[maxRarityReached - 1].label;
    overlayEl.classList.add('active');
  }

  function showLevelUpToast(level) {
    const info = LEVELS[level - 1];
    const toast = document.createElement('div');
    toast.className = 'level-up-toast';
    toast.textContent = `✨ ${info.label} 解放！ / ${info.label} Unlocked! ✨`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1600);
  }

  // ===== Undo =====
  function undo() {
    if (!prevState || undosLeft <= 0 || gameOver) return;
    grid = prevState.grid;
    score = prevState.score;
    maxRarityReached = prevState.maxRarity || maxRarityReached;
    undosLeft--;
    prevState = null;
    renderFull();
  }

  // ===== New Game =====
  function newGame() {
    grid = emptyGrid();
    tileMap = emptyIdGrid();
    score = 0;
    undosLeft = MAX_UNDOS;
    prevState = null;
    gameOver = false;
    maxRarityReached = 1;
    overlayEl.classList.remove('active');
    clearTiles();
    spawnTile();
    spawnTile();
    updateScoreUI();
  }

  // ===== Share =====
  function shareResult() {
    const info = LEVELS[maxRarityReached - 1];
    const text = `【筋肉2048】${info.label}に到達！スコア${score}💪 #MuscleLove #筋肉2048\nhttps://www.patreon.com/cw/MuscleLove`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener');
  }

  // ===== Input: Keyboard =====
  document.addEventListener('keydown', (e) => {
    const keyMap = {
      ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3,
      w: 0, d: 1, s: 2, a: 3,
      W: 0, D: 1, S: 2, A: 3,
    };
    if (e.key in keyMap) {
      e.preventDefault();
      move(keyMap[e.key]);
    }
  });

  // ===== Input: Touch swipe =====
  let touchStartX = 0, touchStartY = 0;
  const swipeThreshold = 30;

  gridEl.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });

  gridEl.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < swipeThreshold) return;

    if (absDx > absDy) {
      move(dx > 0 ? 1 : 3); // right or left
    } else {
      move(dy > 0 ? 2 : 0); // down or up
    }
  }, { passive: true });

  // Prevent scroll on grid
  gridEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });

  // ===== Input: Mouse drag (desktop) =====
  let mouseDown = false, mouseStartX = 0, mouseStartY = 0;
  gridEl.addEventListener('mousedown', (e) => {
    mouseDown = true;
    mouseStartX = e.clientX;
    mouseStartY = e.clientY;
  });
  document.addEventListener('mouseup', (e) => {
    if (!mouseDown) return;
    mouseDown = false;
    const dx = e.clientX - mouseStartX;
    const dy = e.clientY - mouseStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < swipeThreshold) return;
    if (absDx > absDy) {
      move(dx > 0 ? 1 : 3);
    } else {
      move(dy > 0 ? 2 : 0);
    }
  });

  // ===== Buttons =====
  document.getElementById('btn-new').addEventListener('click', newGame);
  document.getElementById('btn-retry').addEventListener('click', newGame);
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-share').addEventListener('click', shareResult);
  document.getElementById('btn-share2').addEventListener('click', shareResult);
  document.getElementById('btn-sound').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    document.getElementById('btn-sound').textContent = soundEnabled ? '🔊' : '🔇';
  });

  // ===== Preload images =====
  LEVELS.forEach(l => {
    const img = new Image();
    img.src = l.img;
  });

  // ===== Init =====
  bestScoreEl.textContent = bestScore;
  newGame();

})();
