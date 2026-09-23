/**
 * Sudoku Pro - Authentication & Player Profile Manager
 * Handles local user accounts, passwords, avatars, session states, and gameplay statistics.
 */

class AuthManager {
  constructor() {
    this.USERS_KEY = 'sudoku_pro_users';
    this.ACTIVE_USER_KEY = 'sudoku_pro_active_user';
    this.AVATARS = ['🦊', '⚡', '🧙', '🚀', '🐱', '🎮', '🧩', '👑', '🐯', '🔥'];
    
    this.initDefaultGuest();
  }

  // Ensure default storage structures exist
  initDefaultGuest() {
    if (!localStorage.getItem(this.USERS_KEY)) {
      const defaultUsers = {
        'guest': {
          username: 'Guest',
          isGuest: true,
          avatar: '👤',
          passwordHash: '',
          createdAt: Date.now(),
          stats: this.createEmptyStats()
        }
      };
      localStorage.setItem(this.USERS_KEY, JSON.stringify(defaultUsers));
    }

    if (!localStorage.getItem(this.ACTIVE_USER_KEY)) {
      localStorage.setItem(this.ACTIVE_USER_KEY, 'guest');
    }
  }

  createEmptyStats() {
    return {
      totalGames: 0,
      totalWins: 0,
      currentStreak: 0,
      bestStreak: 0,
      difficulties: {
        easy: { played: 0, won: 0, bestTime: null },
        medium: { played: 0, won: 0, bestTime: null },
        hard: { played: 0, won: 0, bestTime: null },
        expert: { played: 0, won: 0, bestTime: null }
      }
    };
  }

  getAllUsers() {
    try {
      return JSON.parse(localStorage.getItem(this.USERS_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  saveAllUsers(users) {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
  }

  getActiveUsername() {
    return localStorage.getItem(this.ACTIVE_USER_KEY) || 'guest';
  }

  getCurrentUser() {
    const users = this.getAllUsers();
    const active = this.getActiveUsername();
    return users[active] || users['guest'] || {
      username: 'Guest',
      isGuest: true,
      avatar: '👤',
      stats: this.createEmptyStats()
    };
  }

  isLoggedIn() {
    const user = this.getCurrentUser();
    return user && !user.isGuest;
  }

  // Register new player account
  register(username, password = '', avatar = '🦊') {
    const cleanUsername = username.trim();
    if (!cleanUsername || cleanUsername.length < 1) {
      return { success: false, message: 'Please enter your username.' };
    }
    if (cleanUsername.length > 20) {
      return { success: false, message: 'Username cannot exceed 20 characters.' };
    }

    const key = cleanUsername.toLowerCase();
    const users = this.getAllUsers();

    if (users[key] && !users[key].isGuest) {
      return { success: false, message: 'Username already taken. Please sign in.' };
    }

    // Save new user
    users[key] = {
      username: cleanUsername,
      isGuest: false,
      avatar: avatar || '🦊',
      passwordHash: password ? this.hashPassword(password) : '',
      createdAt: Date.now(),
      stats: this.createEmptyStats()
    };

    this.saveAllUsers(users);
    this.setActiveUser(key);
    return { success: true, user: users[key] };
  }

  // Get list of non-guest registered accounts for easy selection
  getRegisteredUsersList() {
    const users = this.getAllUsers();
    return Object.keys(users)
      .filter(k => !users[k].isGuest)
      .map(k => ({
        key: k,
        username: users[k].username,
        avatar: users[k].avatar || '🦊',
        totalWins: users[k].stats?.totalWins || 0
      }));
  }

  // Login existing player or auto-create account if user is new (zero friction)
  login(username, password = '') {
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      return { success: false, message: 'Please enter your username.' };
    }

    const key = cleanUsername.toLowerCase();
    const users = this.getAllUsers();

    // Case 1: Account already exists
    if (users[key] && !users[key].isGuest) {
      const user = users[key];
      // If user had a password set and a password is entered, verify it
      if (user.passwordHash && password) {
        if (user.passwordHash !== this.hashPassword(password)) {
          return { success: false, message: `Incorrect password for "${cleanUsername}".` };
        }
      }
      this.setActiveUser(key);
      return { success: true, user: user, isNew: false };
    }

    // Case 2: New account auto-creation
    const randomAvatar = this.AVATARS[Math.floor(Math.random() * this.AVATARS.length)];
    return this.register(cleanUsername, password, randomAvatar);
  }

  // Logout back to Guest mode
  logout() {
    this.setActiveUser('guest');
  }

  setActiveUser(usernameKey) {
    localStorage.setItem(this.ACTIVE_USER_KEY, usernameKey);
  }

  hashPassword(password) {
    // Simple fast client-side obfuscation for browser local accounts
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(36);
  }

  // Record game start for statistics
  recordGameStart(difficulty) {
    const users = this.getAllUsers();
    const active = this.getActiveUsername();
    if (!users[active]) return;

    const stats = users[active].stats || this.createEmptyStats();
    stats.totalGames = (stats.totalGames || 0) + 1;
    if (stats.difficulties && stats.difficulties[difficulty]) {
      stats.difficulties[difficulty].played = (stats.difficulties[difficulty].played || 0) + 1;
    }

    users[active].stats = stats;
    this.saveAllUsers(users);
  }

  // Record win
  recordGameWin(difficulty, timeSeconds) {
    const users = this.getAllUsers();
    const active = this.getActiveUsername();
    if (!users[active]) return { isNewBest: false, bestTime: timeSeconds };

    const stats = users[active].stats || this.createEmptyStats();
    stats.totalWins = (stats.totalWins || 0) + 1;
    stats.currentStreak = (stats.currentStreak || 0) + 1;
    if (stats.currentStreak > (stats.bestStreak || 0)) {
      stats.bestStreak = stats.currentStreak;
    }

    let isNewBest = false;
    if (stats.difficulties && stats.difficulties[difficulty]) {
      const diffStat = stats.difficulties[difficulty];
      diffStat.won = (diffStat.won || 0) + 1;
      if (diffStat.bestTime === null || timeSeconds < diffStat.bestTime) {
        diffStat.bestTime = timeSeconds;
        isNewBest = true;
      }
    }

    users[active].stats = stats;
    this.saveAllUsers(users);
    return {
      isNewBest,
      bestTime: stats.difficulties[difficulty]?.bestTime || timeSeconds,
      streak: stats.currentStreak
    };
  }

  // Record loss (mistakes maxed out)
  recordGameLoss() {
    const users = this.getAllUsers();
    const active = this.getActiveUsername();
    if (!users[active]) return;

    const stats = users[active].stats || this.createEmptyStats();
    stats.currentStreak = 0;
    users[active].stats = stats;
    this.saveAllUsers(users);
  }
}

// Global Auth Manager instance
window.authManager = new AuthManager();
