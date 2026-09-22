/**
 * SudokuEngine — Core algorithmic engine for Sudoku generation, validation, and solving.
 * 
 * Features:
 * 1. isValid()        - Checks row, column, and 3x3 box constraints
 * 2. solve()          - Standard Recursive Backtracking algorithm
 * 3. countSolutions() - Verifies puzzle has strictly 1 unique solution
 * 4. generatePuzzle() - Generates valid playable puzzle by difficulty
 * 5. getSmartHint()   - Finds next logical move with clear explanation
 */

class SudokuEngine {

  /**
   * Check if placing `num` at (row, col) is valid according to Sudoku rules.
   */
  static isValid(grid, row, col, num) {
    // 1. Check Row
    for (let c = 0; c < 9; c++) {
      if (c !== col && grid[row][c] === num) return false;
    }

    // 2. Check Column
    for (let r = 0; r < 9; r++) {
      if (r !== row && grid[r][col] === num) return false;
    }

    // 3. Check 3x3 Box
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let r = startRow; r < startRow + 3; r++) {
      for (let c = startCol; c < startCol + 3; c++) {
        if ((r !== row || c !== col) && grid[r][c] === num) return false;
      }
    }

    return true;
  }

  /**
   * Canonical Backtracking Solver.
   * Modifies grid in-place. Returns true if solved, false if unsolvable.
   */
  static solve(grid) {
    // Find the first empty cell (value 0)
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0) {
          // Try digits 1 through 9
          for (let num = 1; num <= 9; num++) {
            if (this.isValid(grid, r, c, num)) {
              grid[r][c] = num; // Place number

              // Recurse to solve rest of the board
              if (this.solve(grid)) return true;

              // Backtrack if it didn't lead to a solution
              grid[r][c] = 0;
            }
          }
          return false; // No number 1-9 fits here -> backtrack
        }
      }
    }
    return true; // All 81 cells filled correctly
  }

  /**
   * Helper to count solutions (up to limit).
   * Used to guarantee generated puzzles have exactly 1 unique solution.
   */
  static countSolutions(grid, countLimit = 2) {
    let count = 0;

    function backtrack(g) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (g[r][c] === 0) {
            for (let num = 1; num <= 9; num++) {
              if (SudokuEngine.isValid(g, r, c, num)) {
                g[r][c] = num;
                backtrack(g);
                g[r][c] = 0;
                if (count >= countLimit) return;
              }
            }
            return;
          }
        }
      }
      count++;
    }

    // Work on a copy
    const copy = grid.map(row => [...row]);
    backtrack(copy);
    return count;
  }

  /**
   * Generate a complete, valid Sudoku solution.
   */
  static generateCompleteBoard() {
    const grid = Array.from({ length: 9 }, () => Array(9).fill(0));

    // Fill the 3 independent diagonal 3x3 boxes first (fast & always valid)
    for (let box = 0; box < 9; box += 3) {
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
      let idx = 0;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          grid[box + r][box + c] = nums[idx++];
        }
      }
    }

    // Solve remaining cells with randomized digit choices
    function solveRandom(g) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (g[r][c] === 0) {
            const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
            for (const d of digits) {
              if (SudokuEngine.isValid(g, r, c, d)) {
                g[r][c] = d;
                if (solveRandom(g)) return true;
                g[r][c] = 0;
              }
            }
            return false;
          }
        }
      }
      return true;
    }

    solveRandom(grid);
    return grid;
  }

  /**
   * Generates a playable puzzle for the given difficulty.
   * Difficulties: 'easy', 'medium', 'hard', 'expert'
   */
  static generatePuzzle(difficulty = 'medium') {
    const solution = this.generateCompleteBoard();
    const puzzle = solution.map(row => [...row]);

    // Number of clues to keep based on difficulty
    const clueTargets = {
      easy: 42,    // 42 given clues (39 empty)
      medium: 34,  // 34 given clues (47 empty)
      hard: 28,    // 28 given clues (53 empty)
      expert: 24   // 24 given clues (57 empty)
    };

    const targetClues = clueTargets[difficulty] || 34;
    const cellsToPrune = 81 - targetClues;

    // Create a shuffled list of all (row, col) positions
    const positions = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        positions.push({ r, c });
      }
    }
    positions.sort(() => Math.random() - 0.5);

    let removed = 0;
    for (const pos of positions) {
      if (removed >= cellsToPrune) break;

      const temp = puzzle[pos.r][pos.c];
      puzzle[pos.r][pos.c] = 0;

      // Verify that the puzzle still has exactly ONE unique solution
      if (this.countSolutions(puzzle, 2) === 1) {
        removed++;
      } else {
        // If removing it creates multiple solutions, put it back
        puzzle[pos.r][pos.c] = temp;
      }
    }

    return {
      puzzle: puzzle,
      solution: solution,
      difficulty: difficulty,
      cluesCount: 81 - removed
    };
  }

  /**
   * Calculate valid candidate numbers for all empty cells on current board.
   */
  static getCandidates(grid) {
    const candidates = Array.from({ length: 9 }, () => Array(9).fill(null));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0) {
          const valid = [];
          for (let num = 1; num <= 9; num++) {
            if (this.isValid(grid, r, c, num)) {
              valid.push(num);
            }
          }
          candidates[r][c] = valid;
        }
      }
    }
    return candidates;
  }

  /**
   * Smart Explainable Hint Engine.
   * Returns a logical hint with human-readable explanation of WHY.
   */
  static getSmartHint(currentGrid, solutionGrid) {
    const candidates = this.getCandidates(currentGrid);

    // 1. Look for a "Naked Single": cell where only 1 number is possible
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentGrid[r][c] === 0 && candidates[r][c].length === 1) {
          const val = candidates[r][c][0];
          return {
            row: r,
            col: c,
            value: val,
            technique: 'Naked Single',
            explanation: `In Row ${r + 1}, Column ${c + 1}, every other number (1-9) is already used in this row, column, or 3x3 box. Therefore, only ${val} is possible!`
          };
        }
      }
    }

    // 2. Look for a "Hidden Single" in Rows: number that can only go in one place in that row
    for (let r = 0; r < 9; r++) {
      for (let num = 1; num <= 9; num++) {
        let possibleCols = [];
        for (let c = 0; c < 9; c++) {
          if (currentGrid[r][c] === 0 && candidates[r][c].includes(num)) {
            possibleCols.push(c);
          }
        }
        if (possibleCols.length === 1) {
          const c = possibleCols[0];
          return {
            row: r,
            col: c,
            value: num,
            technique: 'Hidden Single (Row)',
            explanation: `In Row ${r + 1}, the number ${num} can only be placed in Column ${c + 1} because other cells in this row conflict with columns or boxes.`
          };
        }
      }
    }

    // 3. Fallback: Provide the next logical correct cell from the solution
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentGrid[r][c] === 0) {
          const val = solutionGrid[r][c];
          return {
            row: r,
            col: c,
            value: val,
            technique: 'Direct Solution',
            explanation: `In Row ${r + 1}, Column ${c + 1}, the correct number is ${val}.`
          };
        }
      }
    }

    return null; // Board is already full
  }

  /**
   * Find any conflicting cells (duplicates in same row, column, or box).
   * Returns a Set of keys "r,c" for fast styling.
   */
  static getConflicts(grid) {
    const conflicts = new Set();

    // Check rows
    for (let r = 0; r < 9; r++) {
      const seen = new Map();
      for (let c = 0; c < 9; c++) {
        const val = grid[r][c];
        if (val !== 0) {
          if (seen.has(val)) {
            conflicts.add(`${r},${c}`);
            conflicts.add(`${r},${seen.get(val)}`);
          } else {
            seen.set(val, c);
          }
        }
      }
    }

    // Check columns
    for (let c = 0; c < 9; c++) {
      const seen = new Map();
      for (let r = 0; r < 9; r++) {
        const val = grid[r][c];
        if (val !== 0) {
          if (seen.has(val)) {
            conflicts.add(`${r},${c}`);
            conflicts.add(`${seen.get(val)},${c}`);
          } else {
            seen.set(val, r);
          }
        }
      }
    }

    // Check 3x3 boxes
    for (let b = 0; b < 9; b++) {
      const startR = Math.floor(b / 3) * 3;
      const startC = (b % 3) * 3;
      const seen = new Map();
      for (let r = startR; r < startR + 3; r++) {
        for (let c = startC; c < startC + 3; c++) {
          const val = grid[r][c];
          if (val !== 0) {
            if (seen.has(val)) {
              conflicts.add(`${r},${c}`);
              const prev = seen.get(val);
              conflicts.add(`${prev.r},${prev.c}`);
            } else {
              seen.set(val, { r, c });
            }
          }
        }
      }
    }

    return conflicts;
  }
}

// Export for Node/CommonJS or attach to window for browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SudokuEngine;
} else if (typeof window !== 'undefined') {
  window.SudokuEngine = SudokuEngine;
}
