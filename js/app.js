/**
 * Sudoku Pro - Main Application Controller
 * Handles UI interactions, game loop, timers, keyboard inputs, and state management.
 */

class SudokuApp {
  constructor() {
    this.engine = SudokuEngine;
    this.sound = new SoundManager();

    // Game State
    this.difficulty = 'medium';
    this.initialGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
    this.currentGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
    this.solutionGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
    this.notesGrid = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    
    this.selectedCell = null; // { r, c }
    this.isNotesMode = false;
    this.isPracticeMode = false;
    this.mistakes = 0;
    this.maxMistakes = 3;
    this.timerSeconds = 0;
    this.timerStartTime = null;
    this.timerInterval = null;
    this.isPaused = false;
    this.isGameOver = false;
    this.isWon = false;
    this.currentMode = 'play'; // 'play' or 'solver'

    this.history = [];
    this.redoStack = [];

    // Visualizer instance for solver mode
    this.visualizer = new SudokuVisualizer(
      (r, c, val, state) => this.onVisualizerStep(r, c, val, state),
      (solved) => this.onVisualizerComplete(solved)
    );

    this.initDOM();
    this.bindEvents();
    this.bindAuthEvents();
    this.updateAuthUI();
    this.loadSavedGameOrNew();
  }

  // Cache DOM elements
  initDOM() {
    this.boardEl = document.getElementById('sudoku-board');
    this.timerEl = document.getElementById('game-timer');
    this.mistakesEl = document.getElementById('mistakes-display');
    this.difficultySelect = document.getElementById('difficulty-select');
    this.notesBtn = document.getElementById('btn-notes');
    this.practiceToggle = document.getElementById('practice-toggle');
    this.soundToggle = document.getElementById('sound-toggle');
    this.themeToggle = document.getElementById('theme-toggle');
    this.hintModal = document.getElementById('hint-modal');
    this.victoryModal = document.getElementById('victory-modal');
    this.pauseOverlay = document.getElementById('pause-overlay');

    // Auth & Profile DOM
    this.userProfileBtn = document.getElementById('user-profile-btn');
    this.headerUserAvatar = document.getElementById('header-user-avatar');
    this.headerUserName = document.getElementById('header-user-name');
    this.authModal = document.getElementById('auth-modal');
    this.profileModal = document.getElementById('profile-modal');
  }

  // Bind UI, keyboard, and window events
  bindEvents() {
    // Keyboard inputs
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // Numpad clicks
    document.querySelectorAll('.numpad-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.number, 10);
        this.inputDigit(val);
      });
    });

    // Action button clicks
    document.getElementById('btn-undo').addEventListener('click', () => this.undo());
    document.getElementById('btn-redo').addEventListener('click', () => this.redo());
    document.getElementById('btn-erase').addEventListener('click', () => this.eraseCurrentCell());
    this.notesBtn.addEventListener('click', () => this.toggleNotesMode());
    document.getElementById('btn-hint').addEventListener('click', () => this.requestHint());
    document.getElementById('btn-auto-notes')?.addEventListener('click', () => this.toggleAutoNotes());
    document.getElementById('btn-clear-notes')?.addEventListener('click', () => this.clearAllNotes());
    document.getElementById('btn-new-game').addEventListener('click', () => this.newGame());
    document.getElementById('btn-restart').addEventListener('click', () => this.restartGame());
    document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
    document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());

    // Difficulty selection
    this.difficultySelect.addEventListener('change', (e) => {
      this.difficulty = e.target.value;
      this.newGame();
    });

    // Practice Mode toggle
    this.practiceToggle.addEventListener('change', (e) => {
      this.isPracticeMode = e.target.checked;
      this.updateMistakesDisplay();
    });

    // Sound toggle
    this.soundToggle.addEventListener('click', () => {
      const isMuted = this.sound.toggleMute();
      this.soundToggle.classList.toggle('muted', isMuted);
      this.soundToggle.setAttribute('aria-label', isMuted ? 'Unmute Sound' : 'Mute Sound');
      this.soundToggle.innerText = isMuted ? '🔇' : '🔊';
    });

    // Theme toggle
    this.themeToggle.addEventListener('click', () => this.toggleTheme());

    // Mode switching: Play vs Solver
    document.querySelectorAll('.mode-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.switchMode(tab.dataset.mode);
      });
    });

    // Solver Mode Controls
    document.getElementById('btn-solver-solve')?.addEventListener('click', () => this.solveCustomBoard());
    document.getElementById('btn-solver-visualize')?.addEventListener('click', () => this.visualizeCustomBoard());
    document.getElementById('btn-solver-clear')?.addEventListener('click', () => this.clearBoardForSolver());
    document.getElementById('solver-speed')?.addEventListener('input', (e) => {
      this.visualizer.setSpeed(parseInt(e.target.value, 10));
    });

    // Close Modals
    document.getElementById('close-hint-btn')?.addEventListener('click', () => {
      this.hintModal.classList.add('hidden');
    });
    document.getElementById('apply-hint-btn')?.addEventListener('click', () => {
      if (this.pendingHint) {
        this.applyHint(this.pendingHint);
        this.hintModal.classList.add('hidden');
      }
    });
    document.getElementById('victory-new-game-btn')?.addEventListener('click', () => {
      this.victoryModal.classList.add('hidden');
      this.newGame();
    });
  }

  // Start new game or load from localStorage
  loadSavedGameOrNew() {
    const saved = localStorage.getItem('sudoku_pro_state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        this.difficulty = state.difficulty || 'medium';
        this.difficultySelect.value = this.difficulty;
        this.initialGrid = state.initialGrid;
        this.currentGrid = state.currentGrid;
        this.solutionGrid = state.solutionGrid;
        this.mistakes = state.mistakes || 0;
        this.timerSeconds = state.timerSeconds || 0;
        this.notesGrid = state.notesGrid.map(row => row.map(cellNotes => new Set(cellNotes)));
        this.isPracticeMode = state.isPracticeMode || false;
        this.practiceToggle.checked = this.isPracticeMode;
        
        this.renderBoard();
        this.timerEl.innerText = this.formatTime(this.timerSeconds);
        this.startTimer();
        this.updateMistakesDisplay();
        this.updateRemainingNumbers();
        return;
      } catch (err) {
        console.error('Failed to load saved game:', err);
      }
    }
    this.newGame();
  }

  // Start a fresh game with new generated puzzle
  newGame() {
    this.stopTimer();
    this.isPaused = false;
    this.isGameOver = false;
    this.isWon = false;
    this.mistakes = 0;
    this.timerSeconds = 0;
    this.timerStartTime = null;

    if (window.authManager) {
      window.authManager.recordGameStart(this.difficulty);
    }
    this.timerEl.innerText = '00:00';
    this.pauseOverlay.classList.add('hidden');
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) pauseBtn.innerText = '⏸️';

    this.history = [];
    this.redoStack = [];
    this.selectedCell = null;
    this.notesGrid = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));

    // Generate puzzle using our engine
    const generated = this.engine.generatePuzzle(this.difficulty);
    this.initialGrid = generated.puzzle.map(r => [...r]);
    this.currentGrid = generated.puzzle.map(r => [...r]);
    this.solutionGrid = generated.solution.map(r => [...r]);

    this.renderBoard();
    this.startTimer();
    this.updateMistakesDisplay();
    this.updateRemainingNumbers();
    this.saveState();
  }

  // Restart current puzzle from initial clues
  restartGame() {
    this.stopTimer();
    this.currentGrid = this.initialGrid.map(r => [...r]);
    this.notesGrid = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    this.mistakes = 0;
    this.timerSeconds = 0;
    this.timerStartTime = null;
    this.timerEl.innerText = '00:00';
    this.history = [];
    this.redoStack = [];
    this.isGameOver = false;
    this.isWon = false;
    this.isPaused = false;
    this.pauseOverlay.classList.add('hidden');
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) pauseBtn.innerText = '⏸️';

    this.renderBoard();
    this.startTimer();
    this.updateMistakesDisplay();
    this.updateRemainingNumbers();
    this.saveState();
  }

  // Build the 9x9 Board DOM
  renderBoard() {
    this.boardEl.innerHTML = '';
    const conflicts = this.engine.getConflicts(this.currentGrid);

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        cell.className = 'sudoku-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        // Block border demarcation for 3x3 subgrids
        if (c % 3 === 2 && c !== 8) cell.classList.add('border-right-thick');
        if (r % 3 === 2 && r !== 8) cell.classList.add('border-bottom-thick');

        const val = this.currentGrid[r][c];
        const isInitial = this.initialGrid[r][c] !== 0;

        if (isInitial) {
          cell.classList.add('cell-initial');
          cell.innerText = val;
        } else if (val !== 0) {
          cell.classList.add('cell-user-filled');
          cell.innerText = val;
          // Check correctness
          if (val !== this.solutionGrid[r][c]) {
            cell.classList.add('cell-incorrect');
          }
        } else {
          // Empty cell: Render notes subgrid (3x3)
          const notes = this.notesGrid[r][c];
          if (notes.size > 0) {
            const notesContainer = document.createElement('div');
            notesContainer.className = 'notes-grid';
            for (let n = 1; n <= 9; n++) {
              const noteSpan = document.createElement('span');
              noteSpan.className = 'note-digit';
              noteSpan.innerText = notes.has(n) ? n : '';
              notesContainer.appendChild(noteSpan);
            }
            cell.appendChild(notesContainer);
          }
        }

        // Conflict warning (duplicates)
        if (conflicts.has(`${r},${c}`)) {
          cell.classList.add('cell-conflict');
        }

        // Click to select
        cell.addEventListener('click', () => this.selectCell(r, c));

        this.boardEl.appendChild(cell);
      }
    }

    this.applyHighlights();
    this.updateAutoNotesButtonText();
  }

  // Cell Selection & Highlight Logic
  selectCell(r, c) {
    if (this.isPaused || this.isGameOver) return;
    this.selectedCell = { r, c };
    this.sound.playTap();
    this.applyHighlights();
  }

  // Highlight active row, column, 3x3 box, and matching digits
  applyHighlights() {
    const cells = this.boardEl.querySelectorAll('.sudoku-cell');
    if (!this.selectedCell) {
      cells.forEach(el => el.classList.remove('selected', 'highlighted', 'matching-digit'));
      return;
    }

    const { r: selR, c: selC } = this.selectedCell;
    const selectedVal = this.currentGrid[selR][selC];
    const selBoxR = Math.floor(selR / 3) * 3;
    const selBoxC = Math.floor(selC / 3) * 3;

    cells.forEach((cell) => {
      const r = parseInt(cell.dataset.row, 10);
      const c = parseInt(cell.dataset.col, 10);
      const val = this.currentGrid[r][c];

      cell.classList.remove('selected', 'highlighted', 'matching-digit');

      // 1. Exact selected cell
      if (r === selR && c === selC) {
        cell.classList.add('selected');
      }
      // 2. Crosshair highlighting (same row, col, or box)
      else if (
        r === selR ||
        c === selC ||
        (r >= selBoxR && r < selBoxR + 3 && c >= selBoxC && c < selBoxC + 3)
      ) {
        cell.classList.add('highlighted');
      }

      // 3. Matching digit highlighting
      if (selectedVal !== 0 && val === selectedVal) {
        cell.classList.add('matching-digit');
      }
    });
  }

  // Handle number input (from keyboard or numpad)
  inputDigit(num) {
    if (!this.selectedCell || this.isPaused || this.isGameOver) return;
    const { r, c } = this.selectedCell;

    // Disallow editing initial fixed clues in play mode
    if (this.currentMode === 'play' && this.initialGrid[r][c] !== 0) return;

    // In Solver Mode: allow setting clues directly
    if (this.currentMode === 'solver') {
      this.currentGrid[r][c] = num;
      this.renderBoard();
      return;
    }

    // Notes Mode
    if (this.isNotesMode) {
      if (this.currentGrid[r][c] !== 0) return; // Cannot place notes in filled cells
      const notes = this.notesGrid[r][c];
      if (notes.has(num)) {
        notes.delete(num);
      } else {
        notes.add(num);
      }
      this.sound.playTap();
      this.renderBoard();
      this.saveState();
      return;
    }

    // Regular Number Placement
    const prevVal = this.currentGrid[r][c];
    if (prevVal === num) return; // Already placed

    // Record action for Undo
    this.recordMove({
      r,
      c,
      prevVal,
      newVal: num,
      prevNotes: new Set(this.notesGrid[r][c])
    });

    this.currentGrid[r][c] = num;
    this.notesGrid[r][c].clear(); // Clear notes in this cell

    // Auto-remove this placed digit from candidate notes in the same row, col, and box
    this.removeNoteFromPeers(r, c, num);

    // Check correctness against solution
    const isCorrect = num === this.solutionGrid[r][c];
    if (isCorrect) {
      this.sound.playPlace();
    } else {
      this.sound.playError();
      if (!this.isPracticeMode) {
        this.mistakes++;
        this.updateMistakesDisplay();
        if (this.mistakes >= this.maxMistakes) {
          this.triggerGameOver();
          return;
        }
      }
    }

    this.renderBoard();
    this.updateRemainingNumbers();
    this.saveState();
    this.checkWinCondition();
  }

  // Erase number or notes in active cell
  eraseCurrentCell() {
    if (!this.selectedCell || this.isPaused || this.isGameOver) return;
    const { r, c } = this.selectedCell;

    if (this.currentMode === 'play' && this.initialGrid[r][c] !== 0) return;

    const prevVal = this.currentGrid[r][c];
    const prevNotes = new Set(this.notesGrid[r][c]);

    if (prevVal === 0 && prevNotes.size === 0) return;

    this.recordMove({
      r,
      c,
      prevVal,
      newVal: 0,
      prevNotes
    });

    this.currentGrid[r][c] = 0;
    this.notesGrid[r][c].clear();
    this.sound.playTap();

    this.renderBoard();
    this.updateRemainingNumbers();
    this.saveState();
  }

  // Remove placed number from peer candidate notes
  removeNoteFromPeers(row, col, num) {
    const boxR = Math.floor(row / 3) * 3;
    const boxC = Math.floor(col / 3) * 3;

    for (let i = 0; i < 9; i++) {
      this.notesGrid[row][i].delete(num); // Row
      this.notesGrid[i][col].delete(num); // Col
    }
    for (let r = boxR; r < boxR + 3; r++) {
      for (let c = boxC; c < boxC + 3; c++) {
        this.notesGrid[r][c].delete(num); // Box
      }
    }
  }

  // Check if any cell currently has candidate notes
  hasAnyNotes() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.notesGrid[r][c] && this.notesGrid[r][c].size > 0) return true;
      }
    }
    return false;
  }

  // Update Auto Notes button text and title dynamically
  updateAutoNotesButtonText() {
    const btn = document.getElementById('btn-auto-notes');
    if (!btn) return;
    if (this.hasAnyNotes()) {
      btn.innerText = '🧹 Clear Notes';
      btn.title = 'Click to clear all candidate notes across the board';
      btn.classList.add('active');
    } else {
      btn.innerText = '⚡ Auto Notes';
      btn.title = 'Auto-fill candidate notes across all empty cells';
      btn.classList.remove('active');
    }
  }

  // Toggle Auto Notes (fills if empty, clears if notes are active)
  toggleAutoNotes() {
    if (this.isPaused || this.isGameOver) return;
    if (this.hasAnyNotes()) {
      this.clearAllNotes();
    } else {
      this.autoFillNotes();
    }
  }

  // Clear all notes across the board with Undo support
  clearAllNotes() {
    if (this.isPaused || this.isGameOver) return;
    if (!this.hasAnyNotes()) return;

    const prevNotesSnapshot = this.notesGrid.map(row => row.map(cell => new Set(cell)));
    this.recordMove({
      type: 'bulk_notes',
      notesSnapshot: prevNotesSnapshot
    });

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        this.notesGrid[r][c].clear();
      }
    }

    this.sound.playTap();
    this.renderBoard();
    this.saveState();
  }

  // Auto-Fill all valid candidate notes across empty cells with Undo support
  autoFillNotes() {
    if (this.isPaused || this.isGameOver) return;
    const candidates = this.engine.getCandidates(this.currentGrid);
    const prevNotesSnapshot = this.notesGrid.map(row => row.map(cell => new Set(cell)));

    this.recordMove({
      type: 'bulk_notes',
      notesSnapshot: prevNotesSnapshot
    });

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentGrid[r][c] === 0) {
          this.notesGrid[r][c] = new Set(candidates[r][c]);
        }
      }
    }

    this.sound.playTap();
    this.renderBoard();
    this.saveState();
  }

  // Smart Hint Request
  requestHint() {
    if (this.isPaused || this.isGameOver) return;

    const hint = this.engine.getSmartHint(this.currentGrid, this.solutionGrid);
    if (!hint) {
      alert('Congratulations! The board is already complete.');
      return;
    }

    this.pendingHint = hint;
    this.selectCell(hint.row, hint.col);

    // Populate Hint Modal
    document.getElementById('hint-technique').innerText = hint.technique;
    document.getElementById('hint-location').innerText = `Row ${hint.row + 1}, Col ${hint.col + 1}`;
    document.getElementById('hint-value').innerText = `Value: ${hint.value}`;
    document.getElementById('hint-explanation').innerText = hint.explanation;

    this.hintModal.classList.remove('hidden');
    this.sound.playTap();
  }

  // Apply the suggested hint value to board
  applyHint(hint) {
    this.selectedCell = { r: hint.row, c: hint.col };
    this.inputDigit(hint.value);
  }

  // Undo / Redo Stack
  recordMove(move) {
    this.history.push(move);
    this.redoStack = []; // Clear redo on new action
  }

  undo() {
    if (this.history.length === 0 || this.isPaused || this.isGameOver) return;
    const move = this.history.pop();

    if (move.type === 'bulk_notes') {
      const currentNotesSnapshot = this.notesGrid.map(row => row.map(cell => new Set(cell)));
      this.redoStack.push({
        type: 'bulk_notes',
        notesSnapshot: currentNotesSnapshot
      });
      this.notesGrid = move.notesSnapshot.map(row => row.map(cell => new Set(cell)));
      this.sound.playTap();
      this.renderBoard();
      this.saveState();
      return;
    }

    this.redoStack.push({
      r: move.r,
      c: move.c,
      prevVal: this.currentGrid[move.r][move.c],
      newVal: move.prevVal,
      prevNotes: new Set(this.notesGrid[move.r][move.c])
    });

    this.currentGrid[move.r][move.c] = move.prevVal;
    this.notesGrid[move.r][move.c] = new Set(move.prevNotes);

    this.selectCell(move.r, move.c);
    this.sound.playTap();
    this.renderBoard();
    this.updateRemainingNumbers();
    this.saveState();
  }

  redo() {
    if (this.redoStack.length === 0 || this.isPaused || this.isGameOver) return;
    const move = this.redoStack.pop();

    if (move.type === 'bulk_notes') {
      const currentNotesSnapshot = this.notesGrid.map(row => row.map(cell => new Set(cell)));
      this.history.push({
        type: 'bulk_notes',
        notesSnapshot: currentNotesSnapshot
      });
      this.notesGrid = move.notesSnapshot.map(row => row.map(cell => new Set(cell)));
      this.sound.playTap();
      this.renderBoard();
      this.saveState();
      return;
    }

    this.history.push({
      r: move.r,
      c: move.c,
      prevVal: this.currentGrid[move.r][move.c],
      newVal: move.newVal,
      prevNotes: new Set(this.notesGrid[move.r][move.c])
    });

    this.currentGrid[move.r][move.c] = move.newVal;
    this.selectCell(move.r, move.c);
    this.sound.playTap();
    this.renderBoard();
    this.updateRemainingNumbers();
    this.saveState();
  }

  // Toggle Pencil Notes Mode
  toggleNotesMode() {
    this.isNotesMode = !this.isNotesMode;
    this.notesBtn.classList.toggle('active', this.isNotesMode);
    this.sound.playTap();
  }

  // Check if puzzle is won
  checkWinCondition() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentGrid[r][c] !== this.solutionGrid[r][c]) {
          return false;
        }
      }
    }

    // Win!
    this.isWon = true;
    this.stopTimer();
    this.sound.playWin();

    // Record win in auth profile
    let winResult = { isNewBest: false };
    if (window.authManager) {
      winResult = window.authManager.recordGameWin(this.difficulty, this.timerSeconds);
      this.updateAuthUI();
    }

    // Show Victory Modal with stats
    document.getElementById('victory-time').innerText = this.formatTime(this.timerSeconds);
    document.getElementById('victory-difficulty').innerText = this.difficulty.toUpperCase();
    document.getElementById('victory-mistakes').innerText = this.mistakes;

    const victorySub = document.querySelector('#victory-modal p');
    if (victorySub) {
      const user = window.authManager ? window.authManager.getCurrentUser() : null;
      const name = user && !user.isGuest ? user.username : 'Player';
      victorySub.innerText = winResult.isNewBest
        ? `🔥 Incredible, ${name}! New Personal Best for ${this.difficulty.toUpperCase()} difficulty!`
        : `Outstanding deduction, ${name}! You completed the board!`;
    }

    this.victoryModal.classList.remove('hidden');
    this.triggerConfetti();
    localStorage.removeItem('sudoku_pro_state'); // Clear in-progress game
    return true;
  }

  triggerGameOver() {
    this.isGameOver = true;
    this.stopTimer();
    if (window.authManager) {
      window.authManager.recordGameLoss();
      this.updateAuthUI();
    }
    alert('Game Over! You made 3 mistakes. Click "Restart" or "New Game" to try again.');
  }

  // Update Remaining Counts for 1-9
  updateRemainingNumbers() {
    const counts = Array(10).fill(0);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = this.currentGrid[r][c];
        if (val >= 1 && val <= 9) counts[val]++;
      }
    }

    document.querySelectorAll('.numpad-btn').forEach((btn) => {
      const num = parseInt(btn.dataset.number, 10);
      const remaining = 9 - counts[num];
      const badge = btn.querySelector('.num-remaining');
      if (badge) badge.innerText = Math.max(0, remaining);

      if (remaining <= 0) {
        btn.classList.add('completed');
      } else {
        btn.classList.remove('completed');
      }
    });
  }

  updateMistakesDisplay() {
    if (this.isPracticeMode) {
      this.mistakesEl.innerHTML = `<span style="color: var(--accent); font-weight: 700;">Practice 🎯</span>`;
    } else {
      this.mistakesEl.innerHTML = `Mistakes: <span class="mistake-count">${this.mistakes}/${this.maxMistakes}</span>`;
    }
  }

  // Timer Management (Timestamp-based, perfectly accurate & tab-safe)
  startTimer() {
    this.stopTimer();
    this.timerStartTime = Date.now() - (this.timerSeconds * 1000);
    this.timerEl.innerText = this.formatTime(this.timerSeconds);

    this.timerInterval = setInterval(() => {
      if (!this.isPaused && !this.isGameOver && !this.isWon) {
        this.timerSeconds = Math.floor((Date.now() - this.timerStartTime) / 1000);
        this.timerEl.innerText = this.formatTime(this.timerSeconds);
      }
    }, 250);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  togglePause() {
    if (this.isGameOver || this.isWon) return;
    this.isPaused = !this.isPaused;
    this.pauseOverlay.classList.toggle('hidden', !this.isPaused);
    
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) {
      pauseBtn.innerText = this.isPaused ? '▶️' : '⏸️';
      pauseBtn.setAttribute('title', this.isPaused ? 'Resume Game' : 'Pause Game');
    }

    if (this.isPaused) {
      this.stopTimer();
    } else {
      this.startTimer();
    }
  }

  formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // Theme Management (Dark / Light)
  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('sudoku_theme', next);
    this.themeToggle.innerText = next === 'dark' ? '🌙' : '☀️';
  }

  // Mode Switch (Play vs Custom Solver)
  switchMode(mode) {
    this.currentMode = mode;
    const playControls = document.getElementById('play-controls');
    const solverControls = document.getElementById('solver-controls');

    if (mode === 'solver') {
      this.stopTimer();
      playControls.classList.add('hidden');
      solverControls.classList.remove('hidden');
      this.clearBoardForSolver();
    } else {
      playControls.classList.remove('hidden');
      solverControls.classList.add('hidden');
      this.loadSavedGameOrNew();
    }
  }

  clearBoardForSolver() {
    this.visualizer.stop();
    this.initialGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
    this.currentGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
    this.notesGrid = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    this.selectedCell = null;
    this.renderBoard();
  }

  // Instant Solve in Solver Mode
  solveCustomBoard() {
    const copy = this.currentGrid.map(r => [...r]);
    const solved = this.engine.solve(copy);
    if (solved) {
      this.currentGrid = copy;
      this.sound.playWin();
      this.renderBoard();
    } else {
      alert('This puzzle is invalid or mathematically unsolvable.');
    }
  }

  // Visualize Backtracking in Solver Mode
  visualizeCustomBoard() {
    this.visualizer.visualize(this.currentGrid);
  }

  onVisualizerStep(r, c, val, state) {
    this.currentGrid[r][c] = val;
    const cell = this.boardEl.children[r * 9 + c];
    if (cell) {
      cell.innerText = val !== 0 ? val : '';
      cell.className = 'sudoku-cell ' + (state === 'testing' ? 'cell-visualize-try' : 'cell-visualize-backtrack');
    }
  }

  onVisualizerComplete(solved) {
    if (solved) {
      this.sound.playWin();
    } else {
      alert('Visualizer finished: No solution exists for this configuration.');
    }
    this.renderBoard();
  }

  // Keyboard navigation & inputs
  handleKeyDown(e) {
    // Digits 1-9
    if (e.key >= '1' && e.key <= '9') {
      this.inputDigit(parseInt(e.key, 10));
      return;
    }

    // Erase
    if (e.key === 'Backspace' || e.key === 'Delete') {
      this.eraseCurrentCell();
      return;
    }

    // Arrow keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      if (!this.selectedCell) {
        this.selectCell(0, 0);
        return;
      }
      let { r, c } = this.selectedCell;
      if (e.key === 'ArrowUp') r = (r - 1 + 9) % 9;
      if (e.key === 'ArrowDown') r = (r + 1) % 9;
      if (e.key === 'ArrowLeft') c = (c - 1 + 9) % 9;
      if (e.key === 'ArrowRight') c = (c + 1) % 9;
      this.selectCell(r, c);
      return;
    }

    // Shortcuts
    if (e.key === 'n' || e.key === 'N') this.toggleNotesMode();
    if (e.key === 'h' || e.key === 'H') this.requestHint();
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      this.undo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      this.redo();
    }
    if (e.key === ' ') {
      e.preventDefault();
      this.togglePause();
    }
  }

  // Save current game state to localStorage
  saveState() {
    if (this.currentMode !== 'play' || this.isWon || this.isGameOver) return;
    const state = {
      difficulty: this.difficulty,
      initialGrid: this.initialGrid,
      currentGrid: this.currentGrid,
      solutionGrid: this.solutionGrid,
      mistakes: this.mistakes,
      timerSeconds: this.timerSeconds,
      isPracticeMode: this.isPracticeMode,
      notesGrid: this.notesGrid.map(row => row.map(cellSet => Array.from(cellSet)))
    };
    localStorage.setItem('sudoku_pro_state', JSON.stringify(state));
  }

  // Lightweight Confetti Animation for Win Celebration
  triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6'];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.7) * 16,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 10
      });
    }

    let frames = 0;
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3; // Gravity
        p.rotation += p.vr;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      frames++;
      if (frames < 140) {
        requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    render();
  }

  // ==========================================================================
  // Authentication & Player Profile UI Controllers
  // ==========================================================================

  updateAuthUI() {
    if (!window.authManager) return;
    const user = window.authManager.getCurrentUser();
    if (this.headerUserAvatar) this.headerUserAvatar.innerText = user.avatar || '👤';
    if (this.headerUserName) this.headerUserName.innerText = user.isGuest ? 'Login' : user.username;
    if (this.userProfileBtn) {
      this.userProfileBtn.title = user.isGuest ? 'Sign In or Create Account' : `${user.username}'s Profile & Stats`;
    }
  }

  openAuthModal(defaultTab = 'login') {
    if (!this.authModal) return;
    this.authModal.classList.remove('hidden');
    this.switchAuthTab(defaultTab);
    this.renderSavedAccounts();
  }

  renderSavedAccounts() {
    const wrap = document.getElementById('saved-accounts-wrap');
    const list = document.getElementById('saved-accounts-list');
    if (!wrap || !list || !window.authManager) return;

    const users = window.authManager.getRegisteredUsersList();
    if (users.length === 0) {
      wrap.classList.add('hidden');
      return;
    }

    wrap.classList.remove('hidden');
    list.innerHTML = '';
    users.forEach(u => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'saved-account-chip';
      chip.innerHTML = `<span>${u.avatar}</span><strong>${u.username}</strong>`;
      chip.title = `Click to autofill "${u.username}"`;
      chip.addEventListener('click', () => {
        const uInput = document.getElementById('login-username');
        const pInput = document.getElementById('login-password');
        if (uInput) uInput.value = u.username;
        if (pInput) pInput.focus();
      });
      list.appendChild(chip);
    });
  }

  closeAuthModal() {
    if (!this.authModal) return;
    this.authModal.classList.add('hidden');
    this.clearAuthError();
  }

  switchAuthTab(tab) {
    const tabLogin = document.getElementById('tab-login');
    const tabReg = document.getElementById('tab-register');
    const formLogin = document.getElementById('login-form');
    const formReg = document.getElementById('register-form');
    this.clearAuthError();

    if (tab === 'login') {
      tabLogin?.classList.add('active');
      tabLogin?.setAttribute('aria-selected', 'true');
      tabReg?.classList.remove('active');
      tabReg?.setAttribute('aria-selected', 'false');
      formLogin?.classList.remove('hidden');
      formReg?.classList.add('hidden');
      setTimeout(() => document.getElementById('login-username')?.focus(), 50);
    } else {
      tabReg?.classList.add('active');
      tabReg?.setAttribute('aria-selected', 'true');
      tabLogin?.classList.remove('active');
      tabLogin?.setAttribute('aria-selected', 'false');
      formReg?.classList.remove('hidden');
      formLogin?.classList.add('hidden');
      setTimeout(() => document.getElementById('reg-username')?.focus(), 50);
    }
  }

  showAuthError(msg) {
    const el = document.getElementById('auth-error-msg');
    if (el) {
      el.innerText = msg;
      el.classList.remove('hidden');
    }
  }

  clearAuthError() {
    const el = document.getElementById('auth-error-msg');
    if (el) {
      el.innerText = '';
      el.classList.add('hidden');
    }
  }

  openProfileModal() {
    if (!this.profileModal || !window.authManager) return;
    const user = window.authManager.getCurrentUser();
    
    const avatarEl = document.getElementById('profile-display-avatar');
    const titleEl = document.getElementById('profile-modal-title');
    const badgeEl = document.getElementById('profile-status-badge');
    
    if (avatarEl) avatarEl.innerText = user.avatar || '👤';
    if (titleEl) titleEl.innerText = user.username || 'Guest';
    if (badgeEl) badgeEl.innerText = user.isGuest ? 'Guest Mode' : 'Registered Player';

    const stats = user.stats || window.authManager.createEmptyStats();
    const gamesPlayedEl = document.getElementById('profile-games-played');
    const puzzlesSolvedEl = document.getElementById('profile-puzzles-solved');
    const winRateEl = document.getElementById('profile-win-rate');
    const streakEl = document.getElementById('profile-streak');

    if (gamesPlayedEl) gamesPlayedEl.innerText = stats.totalGames || 0;
    if (puzzlesSolvedEl) puzzlesSolvedEl.innerText = stats.totalWins || 0;
    
    const winRate = stats.totalGames > 0 ? Math.round(((stats.totalWins || 0) / stats.totalGames) * 100) : 0;
    if (winRateEl) winRateEl.innerText = `${winRate}%`;
    if (streakEl) streakEl.innerText = `🔥 ${stats.currentStreak || 0} (Best: ${stats.bestStreak || 0})`;

    const formatDiffTime = (sec) => sec ? this.formatTime(sec) : '--:--';
    const diffs = stats.difficulties || {};
    
    const easyEl = document.getElementById('best-time-easy');
    const medEl = document.getElementById('best-time-medium');
    const hardEl = document.getElementById('best-time-hard');
    const expertEl = document.getElementById('best-time-expert');

    if (easyEl) easyEl.innerText = formatDiffTime(diffs.easy?.bestTime);
    if (medEl) medEl.innerText = formatDiffTime(diffs.medium?.bestTime);
    if (hardEl) hardEl.innerText = formatDiffTime(diffs.hard?.bestTime);
    if (expertEl) expertEl.innerText = formatDiffTime(diffs.expert?.bestTime);

    this.profileModal.classList.remove('hidden');
  }

  closeProfileModal() {
    if (!this.profileModal) return;
    this.profileModal.classList.add('hidden');
  }

  bindAuthEvents() {
    // Header Profile button
    this.userProfileBtn?.addEventListener('click', () => {
      if (window.authManager && window.authManager.isLoggedIn()) {
        this.openProfileModal();
      } else {
        this.openAuthModal('login');
      }
    });

    // Auth Tabs
    document.getElementById('tab-login')?.addEventListener('click', () => this.switchAuthTab('login'));
    document.getElementById('tab-register')?.addEventListener('click', () => this.switchAuthTab('register'));

    // Switch buttons inside forms
    document.getElementById('switch-to-register-btn')?.addEventListener('click', () => {
      const u = document.getElementById('login-username')?.value;
      const p = document.getElementById('login-password')?.value;
      this.switchAuthTab('register');
      if (u) {
        const regUser = document.getElementById('reg-username');
        if (regUser) regUser.value = u;
      }
      if (p) {
        const regPwd = document.getElementById('reg-password');
        if (regPwd) regPwd.value = p;
      }
    });

    document.getElementById('switch-to-login-btn')?.addEventListener('click', () => {
      this.switchAuthTab('login');
    });

    // Password visibility toggles
    const setupPwdToggle = (btnId, inputId) => {
      const btn = document.getElementById(btnId);
      const input = document.getElementById(inputId);
      if (!btn || !input) return;
      btn.addEventListener('click', () => {
        const isPwd = input.type === 'password';
        input.type = isPwd ? 'text' : 'password';
        btn.innerText = isPwd ? '🙈 Hide' : '👁️ Show';
      });
    };
    setupPwdToggle('toggle-login-pwd', 'login-password');
    setupPwdToggle('toggle-reg-pwd', 'reg-password');

    // Avatar Picker selection
    let selectedAvatar = '🦊';
    document.querySelectorAll('.avatar-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selectedAvatar = opt.dataset.avatar || '🦊';
      });
    });

    // Unified Login Handler
    const handleLogin = (e) => {
      if (e) e.preventDefault();
      const u = document.getElementById('login-username')?.value || '';
      const p = document.getElementById('login-password')?.value || '';
      if (!u.trim()) {
        this.showAuthError('Please enter your player name.');
        this.sound?.playError();
        return;
      }
      const res = window.authManager.login(u, p);
      if (res.success) {
        this.closeAuthModal();
        this.updateAuthUI();
        this.sound?.playWin();
        const pInput = document.getElementById('login-password');
        if (pInput) pInput.value = '';
      } else {
        this.showAuthError(res.message);
        this.sound?.playError();
      }
    };

    this.handleLoginDirect = handleLogin;
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('btn-submit-login')?.addEventListener('click', handleLogin);

    // Unified Register Handler
    const handleRegister = (e) => {
      if (e) e.preventDefault();
      const u = document.getElementById('reg-username')?.value || '';
      const p = document.getElementById('reg-password')?.value || '';
      if (!u.trim()) {
        this.showAuthError('Please choose a username.');
        this.sound?.playError();
        return;
      }
      if (!p || p.length < 3) {
        this.showAuthError('Password must be at least 3 characters.');
        this.sound?.playError();
        return;
      }
      const res = window.authManager.register(u, p, selectedAvatar);
      if (res.success) {
        this.closeAuthModal();
        this.updateAuthUI();
        this.sound?.playWin();
        const uInput = document.getElementById('reg-username');
        const pInput = document.getElementById('reg-password');
        if (uInput) uInput.value = '';
        if (pInput) pInput.value = '';
      } else {
        this.showAuthError(res.message);
        this.sound?.playError();
      }
    };

    document.getElementById('register-form')?.addEventListener('submit', handleRegister);
    document.getElementById('btn-submit-register')?.addEventListener('click', handleRegister);

    // Continue as Guest
    document.getElementById('btn-continue-guest')?.addEventListener('click', () => {
      window.authManager.logout();
      this.closeAuthModal();
      this.updateAuthUI();
      this.sound?.playTap();
    });

    // Close Auth Modal
    document.getElementById('btn-close-auth')?.addEventListener('click', () => {
      this.closeAuthModal();
    });

    // Close Profile Modal
    document.getElementById('btn-close-profile')?.addEventListener('click', () => {
      this.closeProfileModal();
    });

    // Logout from Profile Modal
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      window.authManager.logout();
      this.closeProfileModal();
      this.updateAuthUI();
      this.openAuthModal('login');
      this.sound?.playTap();
    });

    // Close on overlay backdrop click
    this.authModal?.addEventListener('click', (e) => {
      if (e.target === this.authModal) this.closeAuthModal();
    });
    this.profileModal?.addEventListener('click', (e) => {
      if (e.target === this.profileModal) this.closeProfileModal();
    });
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Load saved theme
  const savedTheme = localStorage.getItem('sudoku_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.innerText = savedTheme === 'dark' ? '🌙' : '☀️';

  window.app = new SudokuApp();
});
