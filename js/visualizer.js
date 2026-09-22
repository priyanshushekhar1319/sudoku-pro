/**
 * SudokuVisualizer — Asynchronous step-by-step backtracking visualizer.
 * Provides real-time visual representation of depth-first search states and backtracks.
 */
class SudokuVisualizer {
  constructor(onUpdateCell, onComplete) {
    this.onUpdateCell = onUpdateCell; // Callback: (r, c, val, state) => void
    this.onComplete = onComplete;     // Callback: (solved) => void
    this.isRunning = false;
    this.delayMs = 25; // Default speed
  }

  setSpeed(speedMs) {
    this.delayMs = speedMs;
  }

  stop() {
    this.isRunning = false;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Asynchronous backtracking solver that animates each step.
   */
  async visualize(grid) {
    this.isRunning = true;
    const workingGrid = grid.map(r => [...r]);

    const solveStep = async () => {
      if (!this.isRunning) return false;

      // Find first empty cell
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (workingGrid[r][c] === 0) {
            for (let num = 1; num <= 9; num++) {
              if (!this.isRunning) return false;

              if (SudokuEngine.isValid(workingGrid, r, c, num)) {
                workingGrid[r][c] = num;
                // Highlight as 'testing'
                this.onUpdateCell(r, c, num, 'testing');
                if (this.delayMs > 0) await this.sleep(this.delayMs);

                if (await solveStep()) return true;

                // Backtrack
                workingGrid[r][c] = 0;
                this.onUpdateCell(r, c, 0, 'backtrack');
                if (this.delayMs > 0) await this.sleep(this.delayMs);
              }
            }
            return false;
          }
        }
      }
      return true;
    };

    const solved = await solveStep();
    this.isRunning = false;
    if (this.onComplete) this.onComplete(solved);
    return solved;
  }
}

if (typeof window !== 'undefined') {
  window.SudokuVisualizer = SudokuVisualizer;
}
