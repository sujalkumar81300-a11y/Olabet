/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query, withWalletTransaction, mockDb } from './src/db.js';
import { generateServerSeed, calculateLimboMultiplier } from './src/provably-fair.js';
import { createAndShuffleDeck, evaluatePokerHand } from './src/game-poker.js';
import { UserRole, GameTable } from './src/types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-this-in-prod';
const PORT = 3000;

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  
  // Express middlewares
  app.use(express.json());

  // CORS middleware supporting credentials and dynamic origins
  app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    const frontendUrl = process.env.FRONTEND_URL || '*';
    
    res.header('Access-Control-Allow-Origin', origin === frontendUrl ? origin : frontendUrl);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // ============================================
  // SECURITY & RATE LIMITERS
  // ============================================
  
  // General Rate Limiter (60 req/min)
  const generalRateLimits = new Map<string, { count: number; firstRequest: number }>();
  const sensitiveRateLimits = new Map<string, { count: number; firstRequest: number }>();
  const failedLogins = new Map<string, { count: number; lockedUntil: number }>();

  function rateLimiter(limitsMap: Map<string, { count: number; firstRequest: number }>, maxRequests: number, windowSeconds: number) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      const limit = limitsMap.get(ip);
      
      if (!limit) {
        limitsMap.set(ip, { count: 1, firstRequest: now });
        return next();
      }
      
      if (now - limit.firstRequest > windowSeconds * 1000) {
        limit.count = 1;
        limit.firstRequest = now;
        return next();
      }
      
      if (limit.count >= maxRequests) {
        const resetIn = Math.ceil((limit.firstRequest + windowSeconds * 1000 - now) / 1000);
        return res.status(429).json({
          error: `Too many requests. Please try again in ${resetIn} seconds.`,
        });
      }
      
      limit.count++;
      next();
    };
  }

  // Sanitization middleware to protect against XSS
  function sanitizeInput(req: express.Request, res: express.Response, next: express.NextFunction) {
    const sanitize = (val: any): any => {
      if (typeof val === 'string') {
        return val.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
      if (Array.isArray(val)) {
        return val.map(sanitize);
      }
      if (val !== null && typeof val === 'object') {
        const obj: any = {};
        for (const k of Object.keys(val)) {
          obj[k] = sanitize(val[k]);
        }
        return obj;
      }
      return val;
    };
    req.body = sanitize(req.body);
    next();
  }
  app.use(sanitizeInput);

  // Authentication Middleware
  const authenticateUser = async (req: any, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication token required.' });
    }
    
    const token = authHeader.split(' ')[1];
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      // Directly fetch user from database/mock to ensure role and status are authentic
      const userRes = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
      if (userRes.rows.length === 0) {
        return res.status(401).json({ error: 'User not found.' });
      }
      
      const user = userRes.rows[0];
      if (user.is_banned) {
        return res.status(403).json({ error: 'Your account has been banned.' });
      }
      
      req.user = user;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
  };

  // Admin Middleware Checking directly in DB
  const authenticateAdmin = async (req: any, res: express.Response, next: express.NextFunction) => {
    await authenticateUser(req, res, () => {
      if (req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: 'Access restricted to administrators only.' });
      }
      next();
    });
  };

  // Mock Currency rates Scheduler Simulator
  setInterval(async () => {
    try {
      console.log('Scheduled Task: Fetching live currency exchange rates...');
      const codes = ['USD', 'EUR', 'GBP', 'BTC'];
      for (const code of codes) {
        const baseRate = code === 'USD' ? 1.0 : code === 'EUR' ? 0.92 : code === 'GBP' ? 0.79 : 0.000015;
        // Float rate randomly to simulate live API rate updates
        const fluc = (Math.random() - 0.5) * 0.02;
        const rate = parseFloat((baseRate * (1 + fluc)).toFixed(6));
        await query('INSERT INTO currency_rates (currency_code, rate) VALUES ($1, $2) ON CONFLICT (currency_code) DO UPDATE SET rate = EXCLUDED.rate, updated_at = CURRENT_TIMESTAMP', [code, rate]);
      }
    } catch (err) {
      console.error('Failed to run hourly currency rates scheduler:', err);
    }
  }, 1000 * 60 * 60); // hourly

  // Apply default general rate limiting (60 requests/minute)
  app.use('/api', rateLimiter(generalRateLimits, 60, 60));

  // ============================================
  // AUTHENTICATION ENDPOINTS
  // ============================================

  // Rate limited to 10 requests per minute
  app.post(
    '/api/register',
    rateLimiter(sensitiveRateLimits, 10, 60),
    async (req: express.Request, res: express.Response) => {
      const { name, email, password, phone, age_verified } = req.body;
      
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required.' });
      }
      
      if (!age_verified) {
        return res.status(400).json({ error: 'You must be at least 18 years old to register.' });
      }
      
      try {
        const existingRes = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingRes.rows.length > 0) {
          return res.status(400).json({ error: 'Email is already in use.' });
        }
        
        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(password, salt);
        const role = UserRole.USER;
        
        // Insert User
        const userRes = await query(
          'INSERT INTO users (name, email, password_hash, role, age_verified, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id, name, email, role',
          [name, email, passwordHash, role, true]
        );
        const newUser = userRes.rows[0];
        
        // Setup initial virtual wallet of 1000 coins
        await query('INSERT INTO wallets (user_id, balance, created_at, updated_at) VALUES ($1, 1000, NOW(), NOW())', [newUser.id]);
        
        // Log signup adjustment transaction
        await query(
          'INSERT INTO transactions (user_id, type, amount, status, reference_note) VALUES ($1, $2, $3, $4, $5)',
          [newUser.id, 'adjustment', 1000, 'completed', 'Default signup welcome bonus coins']
        );
        
        const token = jwt.sign({ id: newUser.id, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
        
        return res.status(201).json({
          message: 'Registration successful! Verification email sent (placeholder).',
          token,
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            is_verified: false,
          },
        });
      } catch (err: any) {
        console.error('Register error:', err);
        return res.status(500).json({ error: 'Internal registration error.' });
      }
    }
  );

  app.post(
    '/api/login',
    rateLimiter(sensitiveRateLimits, 10, 60),
    async (req: express.Request, res: express.Response) => {
      const { email, password } = req.body;
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
      
      // Throttle/Lock login check
      const throttle = failedLogins.get(ip);
      const now = Date.now();
      if (throttle && throttle.count >= 5 && throttle.lockedUntil > now) {
        const wait = Math.ceil((throttle.lockedUntil - now) / 1000);
        return res.status(429).json({ error: `Account/IP locked. Please try again in ${wait} seconds.` });
      }
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }
      
      try {
        const userRes = await query('SELECT * FROM users WHERE email = $1', [email]);
        const user = userRes.rows[0];
        
        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
          // Record failed login
          const currentCount = throttle && throttle.lockedUntil > now ? throttle.count : 0;
          const newCount = currentCount + 1;
          const lockedUntil = newCount >= 5 ? now + 60000 : 0; // lock for 60 seconds after 5 failed attempts
          failedLogins.set(ip, { count: newCount, lockedUntil });
          
          return res.status(401).json({ error: 'Invalid email or password.' });
        }
        
        if (user.is_banned) {
          return res.status(403).json({ error: 'Your account has been suspended/banned.' });
        }
        
        // Reset failed logins on success
        failedLogins.delete(ip);
        
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        
        return res.json({
          message: 'Login successful!',
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            is_verified: user.is_verified,
          },
        });
      } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Internal login error.' });
      }
    }
  );

  app.post('/api/logout', authenticateUser, (req: any, res: express.Response) => {
    return res.json({ message: 'Successfully logged out.' });
  });

  app.get('/api/user/profile', authenticateUser, async (req: any, res: express.Response) => {
    return res.json({ user: req.user });
  });

  // ============================================
  // VIRTUAL WALLET ENDPOINTS
  // ============================================

  app.get('/api/wallet/balance', authenticateUser, async (req: any, res: express.Response) => {
    try {
      const walletRes = await query('SELECT balance FROM wallets WHERE user_id = $1', [req.user.id]);
      if (walletRes.rows.length === 0) {
        return res.status(404).json({ error: 'Wallet not found.' });
      }
      return res.json({ balance: walletRes.rows[0].balance });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve balance.' });
    }
  });

  app.get('/api/transactions/history', authenticateUser, async (req: any, res: express.Response) => {
    try {
      const txsRes = await query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
      return res.json({ transactions: txsRes.rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve transaction ledger.' });
    }
  });

  // ============================================
  // GAME LOGIC: LIMBO (Server-Authoritative, Provably Fair)
  // ============================================

  app.post(
    '/api/game/limbo/play',
    rateLimiter(sensitiveRateLimits, 15, 60), // Sensitive game play limit
    authenticateUser,
    async (req: any, res: express.Response) => {
      const { bet_amount, target_multiplier, client_seed } = req.body;
      const bet = parseInt(bet_amount, 10);
      const target = parseFloat(target_multiplier);
      
      if (isNaN(bet) || bet <= 0) {
        return res.status(400).json({ error: 'Invalid bet amount.' });
      }
      if (isNaN(target) || target < 1.01) {
        return res.status(400).json({ error: 'Target multiplier must be at least 1.01.' });
      }
      
      const cSeed = client_seed || crypto.randomBytes(8).toString('hex');
      
      try {
        const result = await withWalletTransaction(req.user.id, async (wallet) => {
          if (wallet.balance < bet) {
            return {
              success: false,
              data: { error: 'Insufficient virtual coin balance.' } as any,
              balanceAdjustment: 0,
              referenceNote: '',
              transactionType: 'bet' as any,
            };
          }
          
          // 1. Generate seeds & Calculate Limbo game multiplier
          const { seed: serverSeed, hash: serverSeedHash } = generateServerSeed();
          const nonce = mockDb.gameRounds.length + 1; // Increment round count
          const resultMultiplier = calculateLimboMultiplier(serverSeed, cSeed, nonce);
          
          const isWin = resultMultiplier >= target;
          const winAmount = isWin ? Math.floor(bet * target) : 0;
          const netAdjustment = winAmount - bet;
          
          // 2. Commit Game Round to database
          await query(
            'INSERT INTO game_rounds (user_id, game_type, server_seed, server_seed_hash, client_seed, nonce, result_multiplier, bet_amount, win, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())',
            [req.user.id, 'limbo', serverSeed, serverSeedHash, cSeed, nonce, resultMultiplier, bet, isWin]
          );
          
          return {
            success: true,
            data: {
              result_multiplier: resultMultiplier,
              win: isWin,
              win_amount: winAmount,
              server_seed_revealed: serverSeed,
              server_seed_hash: serverSeedHash,
              new_balance: wallet.balance + netAdjustment,
            } as any,
            balanceAdjustment: netAdjustment,
            referenceNote: isWin
              ? `Limbo Win ${target}x (Result: ${resultMultiplier}x)`
              : `Limbo Bet Placement`,
            transactionType: (isWin ? 'win' : 'bet') as any,
          };
        }) as any;
        
        if (result && result.error) {
          return res.status(400).json(result);
        }
        
        return res.json(result);
      } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Game engine error.' });
      }
    }
  );

  // ============================================
  // GAME LOGIC: RUMMY & POKER
  // ============================================
  const activeTables = new Map<string, GameTable>();

  app.post('/api/game/table/create', authenticateUser, async (req: any, res: express.Response) => {
    const { game_type } = req.body;
    if (game_type !== 'rummy' && game_type !== 'poker') {
      return res.status(400).json({ error: 'Invalid game type. Choose rummy or poker.' });
    }
    
    const id = `table-${game_type}-${Math.random().toString(36).substring(2, 7)}`;
    const deck = createAndShuffleDeck();
    
    const newTable: GameTable = {
      id,
      game_type,
      players: [{
        user_id: req.user.id,
        name: req.user.name,
        cards: [],
        is_folded: false,
        is_declared: false,
        chips_bet: 0,
      }],
      deck,
      discard_pile: [],
      pot: 0,
      state: 'waiting',
      current_turn_index: 0,
      created_at: new Date().toISOString(),
    };
    
    activeTables.set(id, newTable);
    return res.status(201).json({ table: { id, game_type, state: newTable.state, players_count: 1 } });
  });

  app.post('/api/game/table/:id/join', authenticateUser, async (req: any, res: express.Response) => {
    const { id } = req.params;
    const table = activeTables.get(id);
    if (!table) {
      return res.status(404).json({ error: 'Table not found.' });
    }
    
    if (table.state !== 'waiting') {
      return res.status(400).json({ error: 'Table game already started.' });
    }
    
    const exists = table.players.some(p => p.user_id === req.user.id);
    if (!exists) {
      table.players.push({
        user_id: req.user.id,
        name: req.user.name,
        cards: [],
        is_folded: false,
        is_declared: false,
        chips_bet: 0,
      });
    }
    
    // Automatically start the match if we reach 2 players (for quick testing)
    if (table.players.length >= 2 && table.state === 'waiting') {
      table.state = 'playing';
      // Deal 5 cards to each player
      for (const player of table.players) {
        player.cards = [
          table.deck.pop()!,
          table.deck.pop()!,
          table.deck.pop()!,
          table.deck.pop()!,
          table.deck.pop()!
        ];
      }
      table.discard_pile.push(table.deck.pop()!);
      table.pot = table.players.length * 100; // default initial pot bet of 100 coins
      
      // Deduct bet from each player
      for (const player of table.players) {
        player.chips_bet = 100;
        await withWalletTransaction(player.user_id, async (wallet) => {
          return {
            success: true,
            data: {},
            balanceAdjustment: -100,
            referenceNote: `Joined ${table.game_type.toUpperCase()} Table: ${id}`,
            transactionType: 'bet',
          };
        });
      }
      
      broadcastToTable(id, { event: 'game_started', table: getSanitizedTable(table) });
    } else {
      broadcastToTable(id, { event: 'player_joined', name: req.user.name, table: getSanitizedTable(table) });
    }
    
    return res.json({ message: 'Successfully joined table.', table: getSanitizedTable(table) });
  });

  // Strict Security: Returns ONLY the authenticated player's own cards
  app.get('/api/game/table/:id/my-cards', authenticateUser, (req: any, res: express.Response) => {
    const { id } = req.params;
    const table = activeTables.get(id);
    if (!table) {
      return res.status(404).json({ error: 'Table not found.' });
    }
    
    const player = table.players.find(p => p.user_id === req.user.id);
    if (!player) {
      return res.status(403).json({ error: 'You are not seated at this table.' });
    }
    
    return res.json({ cards: player.cards });
  });

  app.post('/api/game/table/:id/action', authenticateUser, async (req: any, res: express.Response) => {
    const { id } = req.params;
    const { action } = req.body; // 'draw', 'discard', 'fold', 'declare'
    const table = activeTables.get(id);
    
    if (!table) {
      return res.status(404).json({ error: 'Table not found.' });
    }
    
    if (table.state !== 'playing') {
      return res.status(400).json({ error: 'Game is not in playing state.' });
    }
    
    const turnPlayer = table.players[table.current_turn_index];
    if (turnPlayer.user_id !== req.user.id) {
      return res.status(400).json({ error: 'It is not your turn.' });
    }
    
    if (action === 'draw') {
      if (table.deck.length === 0) {
        table.deck = createAndShuffleDeck();
      }
      const newCard = table.deck.pop()!;
      turnPlayer.cards.push(newCard);
      
      broadcastToTable(id, { event: 'player_drew', name: req.user.name, table: getSanitizedTable(table) });
      return res.json({ message: 'Drew card successfully.', card: newCard });
    }
    
    if (action === 'discard') {
      const { card } = req.body;
      const idx = turnPlayer.cards.indexOf(card);
      if (idx === -1) {
        return res.status(400).json({ error: 'You do not hold that card.' });
      }
      
      turnPlayer.cards.splice(idx, 1);
      table.discard_pile.push(card);
      
      // Advance turn
      table.current_turn_index = (table.current_turn_index + 1) % table.players.length;
      broadcastToTable(id, { event: 'player_discarded', name: req.user.name, card, table: getSanitizedTable(table) });
      return res.json({ message: 'Discarded card successfully.' });
    }
    
    if (action === 'fold') {
      turnPlayer.is_folded = true;
      broadcastToTable(id, { event: 'player_folded', name: req.user.name, table: getSanitizedTable(table) });
      
      // Check if only one player left unfolded
      const activePlayers = table.players.filter(p => !p.is_folded);
      if (activePlayers.length === 1) {
        await resolveTableWinner(table, activePlayers[0].user_id);
      } else {
        table.current_turn_index = (table.current_turn_index + 1) % table.players.length;
      }
      return res.json({ message: 'Folded successfully.' });
    }
    
    if (action === 'declare') {
      // Evaluate winner using Poker evaluator
      let bestScore = -1;
      let winnerId = table.players[0].user_id;
      const handsSummary: any = {};
      
      for (const p of table.players) {
        if (!p.is_folded) {
          const evalRes = evaluatePokerHand(p.cards);
          handsSummary[p.name] = { cards: p.cards, hand: evalRes.name };
          if (evalRes.score > bestScore) {
            bestScore = evalRes.score;
            winnerId = p.user_id;
          }
        }
      }
      
      await resolveTableWinner(table, winnerId, handsSummary);
      return res.json({ message: 'Table declared, winner resolved.' });
    }
    
    return res.status(400).json({ error: 'Invalid table action.' });
  });

  async function resolveTableWinner(table: GameTable, winnerId: number, handsSummary?: any) {
    table.state = 'completed';
    table.winner_id = winnerId;
    
    const winnerPlayer = table.players.find(p => p.user_id === winnerId)!;
    
    // Credit pot to winner's wallet
    await withWalletTransaction(winnerId, async (wallet) => {
      return {
        success: true,
        data: {},
        balanceAdjustment: table.pot,
        referenceNote: `Won Table: ${table.id} (${table.game_type.toUpperCase()})`,
        transactionType: 'win',
      };
    });
    
    // Store in historical completed tables
    await query(
      'INSERT INTO game_histories (table_id, game_type, players, winner_user_id, bet_amount, result_data, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
      [
        table.id,
        table.game_type,
        JSON.stringify(table.players.map(p => p.name)),
        winnerId,
        table.pot,
        JSON.stringify(handsSummary || { winner_hand: 'All folded' }),
      ]
    );
    
    broadcastToTable(table.id, {
      event: 'game_over',
      winner: winnerPlayer.name,
      pot: table.pot,
      hands: handsSummary,
      table: getSanitizedTable(table),
    });
  }

  // Sanitizes table to hide hidden card info of other players from the clients
  function getSanitizedTable(table: GameTable) {
    return {
      id: table.id,
      game_type: table.game_type,
      state: table.state,
      pot: table.pot,
      discard_pile: table.discard_pile,
      current_turn_index: table.current_turn_index,
      winner_id: table.winner_id,
      players: table.players.map(p => ({
        user_id: p.user_id,
        name: p.name,
        cards_count: p.cards.length,
        is_folded: p.is_folded,
        is_declared: p.is_declared,
        chips_bet: p.chips_bet,
      })),
    };
  }

  // ============================================
  // OTHER UTILITY ENDPOINTS
  // ============================================

  app.get('/api/currency-rates', async (req: express.Request, res: express.Response) => {
    try {
      const ratesRes = await query('SELECT * FROM currency_rates ORDER BY currency_code ASC');
      return res.json({ rates: ratesRes.rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch currency exchange rates.' });
    }
  });

  app.get('/api/chat-config', (req: express.Request, res: express.Response) => {
    return res.json({
      tawkto_property_id: process.env.TAWKTO_PROPERTY_ID || 'tawkto-property-id-placeholder',
      tawkto_widget_id: process.env.TAWKTO_WIDGET_ID || 'tawkto-widget-id-placeholder',
    });
  });

  // ============================================
  // FILAMENT-STYLE ADMIN PANEL API ENDPOINTS
  // ============================================

  app.get('/api/admin/stats', authenticateAdmin, async (req: any, res: express.Response) => {
    try {
      const usersCount = await query('SELECT COUNT(*) as count FROM users');
      const circulationCoins = await query('SELECT SUM(balance) as sum FROM wallets');
      const gamesToday = await query('SELECT COUNT(*) as count FROM game_rounds WHERE created_at >= NOW() - INTERVAL \'1 DAY\'');
      const activeUsers = await query(`
        SELECT u.name, COUNT(r.id) as rounds_played 
        FROM users u 
        LEFT JOIN game_rounds r ON u.id = r.user_id 
        GROUP BY u.id, u.name 
        ORDER BY rounds_played DESC LIMIT 5
      `);
      
      return res.json({
        total_users: parseInt(usersCount.rows[0]?.count || '0', 10),
        coins_in_circulation: parseInt(circulationCoins.rows[0]?.sum || '0', 10),
        games_played_today: parseInt(gamesToday.rows[0]?.count || '0', 10),
        most_active_users: activeUsers.rows,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Admin statistics pull failed.' });
    }
  });

  app.get('/api/admin/users', authenticateAdmin, async (req: any, res: express.Response) => {
    try {
      const usersRes = await query(`
        SELECT u.id, u.name, u.email, u.phone, u.role, u.is_verified, u.age_verified, u.is_banned, u.created_at, w.balance 
        FROM users u 
        LEFT JOIN wallets w ON u.id = w.user_id 
        ORDER BY u.id ASC
      `);
      return res.json({ users: usersRes.rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve admin user list.' });
    }
  });

  app.post('/api/admin/users/ban', authenticateAdmin, async (req: any, res: express.Response) => {
    const { userId, isBanned } = req.body;
    try {
      await query('UPDATE users SET is_banned = $1, updated_at = NOW() WHERE id = $2', [isBanned, userId]);
      return res.json({ message: `User account ban status updated to ${isBanned}.` });
    } catch (err) {
      return res.status(500).json({ error: 'Ban status change failed.' });
    }
  });

  app.post('/api/admin/wallets/adjust', authenticateAdmin, async (req: any, res: express.Response) => {
    const { userId, adjustmentAmount, reasonNote } = req.body;
    const coins = parseInt(adjustmentAmount, 10);
    
    if (isNaN(coins) || coins === 0) {
      return res.status(400).json({ error: 'Adjustment amount must be a non-zero integer.' });
    }
    if (!reasonNote) {
      return res.status(400).json({ error: 'Adjustment reason note is required.' });
    }
    
    try {
      await withWalletTransaction(userId, async (wallet) => {
        return {
          success: true,
          data: {},
          balanceAdjustment: coins,
          referenceNote: `Admin Manual Adjustment: ${reasonNote}`,
          transactionType: 'adjustment',
        };
      });
      return res.json({ message: 'User coin wallet balance adjusted successfully.' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Balance adjustment failed.' });
    }
  });

  app.get('/api/admin/transactions', authenticateAdmin, async (req: any, res: express.Response) => {
    try {
      const txRes = await query(`
        SELECT t.id, t.user_id, u.name as user_name, t.type, t.amount, t.status, t.reference_note, t.created_at 
        FROM transactions t 
        LEFT JOIN users u ON t.user_id = u.id 
        ORDER BY t.created_at DESC
      `);
      return res.json({ transactions: txRes.rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve ledger.' });
    }
  });

  app.get('/api/admin/rounds', authenticateAdmin, async (req: any, res: express.Response) => {
    try {
      const roundsRes = await query(`
        SELECT r.id, r.user_id, u.name as user_name, r.server_seed, r.server_seed_hash, r.client_seed, r.nonce, r.result_multiplier, r.bet_amount, r.win, r.created_at 
        FROM game_rounds r 
        LEFT JOIN users u ON r.user_id = u.id 
        ORDER BY r.created_at DESC
      `);
      return res.json({ rounds: roundsRes.rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve rounds.' });
    }
  });

  app.get('/api/admin/histories', authenticateAdmin, async (req: any, res: express.Response) => {
    try {
      const historiesRes = await query(`
        SELECT h.id, h.table_id, h.game_type, h.players, h.winner_user_id, u.name as winner_name, h.bet_amount, h.result_data, h.created_at 
        FROM game_histories h 
        LEFT JOIN users u ON h.winner_user_id = u.id 
        ORDER BY h.created_at DESC
      `);
      return res.json({ histories: historiesRes.rows });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve card table histories.' });
    }
  });

  // ============================================
  // WEBSOCKET BROADCASTING ENGINE
  // ============================================
  const wss = new WebSocketServer({ noServer: true });
  const connections = new Map<string, Set<WebSocket>>();

  function broadcastToTable(tableId: string, data: any) {
    const clients = connections.get(tableId);
    if (clients) {
      const raw = JSON.stringify(data);
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(raw);
        }
      }
    }
  }

  httpServer.on('upgrade', (request, socket, head) => {
    const { pathname, searchParams } = new URL(request.url || '', `http://${request.headers.host}`);
    
    if (pathname.startsWith('/ws/table/')) {
      const tableId = pathname.substring(10);
      const token = searchParams.get('token');
      
      try {
        if (!token) throw new Error('Missing authentication token.');
        const decoded: any = jwt.verify(token, JWT_SECRET);
        
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, tableId, decoded.id);
        });
      } catch (err) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      }
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, tableId: string, userId: number) => {
    let list = connections.get(tableId);
    if (!list) {
      list = new Set<WebSocket>();
      connections.set(tableId, list);
    }
    list.add(ws);
    console.log(`WebSocket client connected to table ${tableId} (User ID: ${userId})`);

    ws.on('close', () => {
      const clients = connections.get(tableId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          connections.delete(tableId);
        }
      }
    });
  });

  // ============================================
  // VITE DEV SERVER / PRODUCTION SERVING
  // ============================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Gaming Platform Standalone Backend running on http://localhost:${PORT}`);
  });
}

startServer();
