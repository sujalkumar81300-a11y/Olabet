/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Wallet as WalletIcon, 
  History, 
  TrendingUp, 
  ShieldCheck, 
  MessageSquare, 
  Lock, 
  RefreshCw, 
  Plus, 
  UserPlus, 
  Play, 
  Maximize2, 
  Coins, 
  UserMinus, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  ChevronRight,
  Code
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'wallets' | 'transactions' | 'limbo' | 'table-games' | 'api-tester'>('dashboard');
  const [token, setToken] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('admin@gaming.com');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Stats Dashboard
  const [stats, setStats] = useState({
    total_users: 4,
    coins_in_circulation: 128500,
    games_played_today: 2,
    most_active_users: [
      { name: 'Lucky Gamer', rounds_played: 2 },
      { name: 'Admin Operator', rounds_played: 1 }
    ]
  });

  // Admin Data lists
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [limboRounds, setLimboRounds] = useState<any[]>([]);
  const [tableHistories, setTableHistories] = useState<any[]>([]);
  
  // Adjustment modal state
  const [adjustUserId, setAdjustUserId] = useState<number | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('1000');
  const [adjustReason, setAdjustReason] = useState('Loyalty credit reward');
  const [adjustMsg, setAdjustMsg] = useState('');

  // API Tester States
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiEndpoint, setApiEndpoint] = useState<string>('');
  const [apiPayload, setApiPayload] = useState<string>('');

  // Limbo simulation state
  const [limboBet, setLimboBet] = useState('100');
  const [limboTarget, setLimboTarget] = useState('2.00');
  const [limboClientSeed, setLimboClientSeed] = useState('lucky_seed_1');

  // Poker simulation state
  const [selectedTableId, setSelectedTableId] = useState('');
  const [tableGameType, setTableGameType] = useState<'poker' | 'rummy'>('poker');
  const [tableAction, setTableAction] = useState('draw');
  const [tableCardToDiscard, setTableCardToDiscard] = useState('');

  // Currency exchange rates
  const [exchangeRates, setExchangeRates] = useState<any[]>([]);

  // Fetch all admin lists
  const fetchAdminData = async (jwtToken: string) => {
    try {
      const headers = { 'Authorization': `Bearer ${jwtToken}`, 'Content-Type': 'application/json' };
      
      const statsRes = await fetch('/api/admin/stats', { headers }).then(res => res.json());
      if (statsRes && !statsRes.error) setStats(statsRes);

      const usersRes = await fetch('/api/admin/users', { headers }).then(res => res.json());
      if (usersRes && usersRes.users) setUsers(usersRes.users);

      const txsRes = await fetch('/api/admin/transactions', { headers }).then(res => res.json());
      if (txsRes && txsRes.transactions) setTransactions(txsRes.transactions);

      const roundsRes = await fetch('/api/admin/rounds', { headers }).then(res => res.json());
      if (roundsRes && roundsRes.rounds) setLimboRounds(roundsRes.rounds);

      const historiesRes = await fetch('/api/admin/histories', { headers }).then(res => res.json());
      if (historiesRes && historiesRes.histories) setTableHistories(historiesRes.histories);

      const ratesRes = await fetch('/api/currency-rates').then(res => res.json());
      if (ratesRes && ratesRes.rates) setExchangeRates(ratesRes.rates);
    } catch (err) {
      console.error('Failed to pull backend data, using mock fallback values.', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        setAuthError(data.error || 'Login failed.');
        return;
      }
      
      setToken(data.token);
      setCurrentUser(data.user);
      setAuthSuccess('Successfully authenticated! Loaded Admin session.');
      fetchAdminData(data.token);
    } catch (err) {
      setAuthError('Connection failed. Server might be offline.');
    }
  };

  // Perform virtual coin adjustment
  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustUserId) return;
    setAdjustMsg('');
    
    try {
      const res = await fetch('/api/admin/wallets/adjust', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          userId: adjustUserId,
          adjustmentAmount: parseInt(adjustAmount, 10),
          reasonNote: adjustReason
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setAdjustMsg(`Error: ${data.error}`);
      } else {
        setAdjustMsg('Wallet coins adjusted successfully!');
        fetchAdminData(token);
        setTimeout(() => setAdjustUserId(null), 1500);
      }
    } catch (err) {
      setAdjustMsg('Adjustment failed.');
    }
  };

  const toggleBan = async (userId: number, currentBanned: boolean) => {
    try {
      const res = await fetch('/api/admin/users/ban', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ userId, isBanned: !currentBanned })
      });
      if (res.ok) {
        fetchAdminData(token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Quick tests for the frontend API Tester
  const testEndpoint = async (method: string, url: string, payloadObj?: any) => {
    setApiEndpoint(`${method} ${url}`);
    setApiPayload(payloadObj ? JSON.stringify(payloadObj, null, 2) : 'No payload');
    
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const options: any = { method, headers };
      if (payloadObj && method !== 'GET') {
        options.body = JSON.stringify(payloadObj);
      }
      
      const res = await fetch(url, options);
      const data = await res.json();
      setApiResponse(data);
      if (res.ok && (url.includes('login') || url.includes('register')) && data.token) {
        setToken(data.token);
        setCurrentUser(data.user);
        fetchAdminData(data.token);
      }
    } catch (err: any) {
      setApiResponse({ error: 'Connection failed', message: err.toString() });
    }
  };

  useEffect(() => {
    // Check if live currency exchange rate display is available
    fetch('/api/currency-rates')
      .then(res => res.json())
      .then(data => {
        if (data && data.rates) setExchangeRates(data.rates);
      }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-indigo-600 selection:text-white" id="main_container">
      <div className="flex-1 flex flex-col lg:flex-row" id="main_layout">
        
        {/* SIDEBAR */}
        <aside className="w-full lg:w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800" id="aside_navigation">
          {/* Logo Brand Header */}
          <div className="p-6 flex items-center gap-3 border-b border-slate-800/80">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">G</div>
            <div>
              <h1 className="text-white font-bold tracking-tight text-lg">GamingAdmin</h1>
              <p className="text-[10px] text-slate-500 font-mono tracking-wider">VELAS PLATFORM</p>
            </div>
          </div>

          {!token ? (
            <div className="p-5 flex flex-col gap-4">
              <div className="bg-slate-800/40 border border-slate-800/60 p-4 rounded-xl flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-200 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-400" /> Admin Access
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Sign in with default admin credentials generated via database seed.
                </p>
                
                <form onSubmit={handleLogin} className="flex flex-col gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Email</label>
                    <input 
                      type="email" 
                      value={loginEmail} 
                      onChange={e => setLoginEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="admin@gaming.com"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Password</label>
                    <input 
                      type="password" 
                      value={loginPassword} 
                      onChange={e => setLoginPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="password"
                    />
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <input type="checkbox" id="age_verify" defaultChecked disabled className="rounded text-indigo-500 focus:ring-0 bg-slate-950 border-slate-800 w-3.5 h-3.5" />
                    <label htmlFor="age_verify" className="text-[10px] text-slate-400 font-medium">Age Verified (18+)</label>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full mt-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg text-xs transition duration-150 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <ShieldCheck className="w-4 h-4" /> Authenticate
                  </button>
                </form>

                {authError && <p className="text-[11px] text-red-400 bg-red-950/20 border border-red-900/30 p-2 rounded-lg font-mono">{authError}</p>}
                {authSuccess && <p className="text-[11px] text-indigo-400 bg-indigo-950/20 border border-indigo-900/30 p-2 rounded-lg font-mono">{authSuccess}</p>}
              </div>
            </div>
          ) : (
            <div className="flex-1 px-4 py-6 space-y-6">
              <div>
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-3 px-2">Management</div>
                <nav className="space-y-1">
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <TrendingUp className="w-4 h-4" /> System Stats
                  </button>
                  <button 
                    onClick={() => setActiveTab('users')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <Users className="w-4 h-4" /> Users List
                  </button>
                  <button 
                    onClick={() => setActiveTab('wallets')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'wallets' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <WalletIcon className="w-4 h-4" /> Wallets
                  </button>
                  <button 
                    onClick={() => setActiveTab('transactions')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'transactions' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <History className="w-4 h-4" /> Transactions
                  </button>
                </nav>
              </div>

              <div>
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-3 px-2">Game Audit</div>
                <nav className="space-y-1">
                  <button 
                    onClick={() => setActiveTab('limbo')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'limbo' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <Play className="w-4 h-4" /> Limbo Rounds
                  </button>
                  <button 
                    onClick={() => setActiveTab('table-games')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'table-games' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <Maximize2 className="w-4 h-4" /> Table History
                  </button>
                </nav>
              </div>

              <div>
                <div className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-3 px-2">System</div>
                <nav className="space-y-1">
                  <button 
                    onClick={() => setActiveTab('api-tester')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'api-tester' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <Code className="w-4 h-4" /> API Explorer
                  </button>
                </nav>
              </div>
            </div>
          )}

          {/* Exchange Rates Display on Sidebar */}
          <div className="mt-auto p-4 border-t border-slate-800">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block mb-2 px-2">Exchange Rates</span>
            <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-800/60 flex flex-col gap-2">
              {exchangeRates.length > 0 ? (
                exchangeRates.map((rate: any) => (
                  <div key={rate.id} className="flex justify-between items-center text-[11px] font-mono">
                    <span className="text-slate-400">{rate.currency_code} / USD</span>
                    <span className="text-indigo-400 font-bold">{rate.rate}</span>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-slate-500 italic text-center">No active rates found</div>
              )}
              <div className="text-[9px] text-slate-500 text-center mt-1 border-t border-slate-800/40 pt-1.5 italic">
                Updated hourly from API
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col min-w-0" id="main_pane">
          
          {/* TOP HEADER */}
          <header className="h-16 bg-white border-b border-slate-200 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-40" id="header_section">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm font-medium">Dashboard</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-semibold text-sm capitalize">
                {activeTab === 'dashboard' ? 'Overview' : activeTab.replace('-', ' ')}
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-100">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[10px] font-bold uppercase tracking-wider">Reverb Live</span>
              </div>

              {currentUser && (
                <div className="flex items-center gap-3 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white uppercase">
                    {currentUser.name ? currentUser.name.substring(0, 2) : 'AD'}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-semibold text-slate-700 leading-tight">{currentUser.name || 'Super Admin'}</p>
                    <p className="text-[9px] text-slate-400 leading-none">{currentUser.email}</p>
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* VIEWPORT BODY CONTENT */}
          <div className="p-6 lg:p-8 space-y-6 flex-1 overflow-y-auto">
            {!token ? (
              <div className="max-w-2xl mx-auto mt-8 flex flex-col items-center justify-center text-center gap-6" id="welcome_gate">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
                  <ShieldCheck className="w-10 h-10 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">Gaming Administration & API Ecosystem</h2>
                  <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto leading-relaxed">
                    A high-fidelity back-office to control users, balance adjustments, provably fair cryptography seeds, and live card room evaluation metrics.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl w-full text-left font-mono text-xs flex flex-col gap-3">
                  <div className="text-indigo-600 font-bold uppercase tracking-wider text-[11px] font-sans">Quick Start Instructions</div>
                  <div className="text-slate-600 flex items-center gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> 
                    <span>Log in on the sidebar using <span className="font-bold text-indigo-600">admin@gaming.com</span> / <span className="font-bold text-indigo-600">admin123</span></span>
                  </div>
                  <div className="text-slate-600 flex items-center gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> 
                    <span>If you would like to run API calls as a standard player, use the <span className="font-bold text-slate-800">API Explorer</span>.</span>
                  </div>
                  <div className="text-slate-600 flex items-center gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> 
                    <span>Real PostgreSQL migrations are ready at <span className="font-bold text-indigo-600">/migration.sql</span> for Supabase production deploy.</span>
                  </div>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {/* Stats & Dashboard tab */}
                {activeTab === 'dashboard' && (
                  <motion.div 
                    key="dashboard"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans">System Metrics</h2>
                        <p className="text-xs text-slate-500">Real-time gaming operations and wallet statistics</p>
                      </div>
                      <button 
                        onClick={() => fetchAdminData(token)}
                        className="p-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 shadow-sm transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>

                    {/* KPI STATS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                          <p className="text-slate-500 text-xs font-semibold uppercase tracking-tight">Total Active Users</p>
                          <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{stats.total_users}</p>
                          <p className="text-green-600 text-[10px] font-medium mt-1">+12% from yesterday</p>
                        </div>
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100">
                          <Users className="w-6 h-6" />
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                          <p className="text-slate-500 text-xs font-semibold uppercase tracking-tight">Coins in Circulation</p>
                          <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                            {stats.coins_in_circulation.toLocaleString()} <span className="text-slate-400 text-sm font-medium italic">chips</span>
                          </p>
                          <p className="text-slate-400 text-[10px] font-medium mt-1">Total wallet aggregate</p>
                        </div>
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
                          <Coins className="w-6 h-6" />
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                          <p className="text-slate-500 text-xs font-semibold uppercase tracking-tight">Limbo Rounds Run</p>
                          <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">{stats.games_played_today}</p>
                          <p className="text-indigo-600 text-[10px] font-medium mt-1">Active live sessions</p>
                        </div>
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100">
                          <Play className="w-6 h-6" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Activity Feed */}
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                        <h3 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-2 border-b border-slate-100 pb-3">
                          <TrendingUp className="w-4 h-4 text-indigo-600" /> Most Active Game Players
                        </h3>
                        <div className="flex flex-col gap-2">
                          {stats.most_active_users.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100/80 hover:bg-slate-100/50 transition">
                              <span className="text-xs font-semibold text-slate-700">{item.name}</span>
                              <span className="text-xs font-mono text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-full">{item.rounds_played} Rounds</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Quick Launch Integration links */}
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                        <h3 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-2 border-b border-slate-100 pb-3">
                          <MessageSquare className="w-4 h-4 text-indigo-600" /> Live Chat Embed Config
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          The client interface fetches <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-semibold font-mono text-[11px]">GET /api/chat-config</code> to dynamically configure and inject the Tawk.to live helper.
                        </p>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex flex-col gap-1.5 text-xs font-mono text-slate-600">
                          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">// Embed parameters</div>
                          <div>TAWKTO_PROPERTY_ID: <span className="text-slate-850 font-bold">{process.env.TAWKTO_PROPERTY_ID || 'tawkto-property-id-placeholder'}</span></div>
                          <div>TAWKTO_WIDGET_ID: <span className="text-slate-850 font-bold">{process.env.TAWKTO_WIDGET_ID || 'tawkto-widget-id-placeholder'}</span></div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Users tab */}
                {activeTab === 'users' && (
                  <motion.div 
                    key="users"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col gap-6"
                  >
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-slate-900">Users Directory</h2>
                      <p className="text-xs text-slate-500">View user verification status, ban actions, and virtual wallet balances</p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-bold">
                            <th className="py-3.5 px-4">ID</th>
                            <th className="py-3.5 px-4">Name</th>
                            <th className="py-3.5 px-4">Email</th>
                            <th className="py-3.5 px-4">Role</th>
                            <th className="py-3.5 px-4">Verified</th>
                            <th className="py-3.5 px-4">Balance (Coins)</th>
                            <th className="py-3.5 px-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-600">
                          {users.map((u) => (
                            <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                              <td className="p-4 font-mono font-bold text-slate-400">{u.id}</td>
                              <td className="p-4 font-semibold text-slate-850">{u.name}</td>
                              <td className="p-4 text-slate-500">{u.email}</td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="p-4">
                                {u.is_verified ? (
                                  <span className="text-green-600 flex items-center gap-1 font-semibold text-[11px]"><CheckCircle className="w-4 h-4 text-green-500" /> Yes</span>
                                ) : (
                                  <span className="text-slate-400 flex items-center gap-1 text-[11px]"><XCircle className="w-4 h-4 text-slate-300" /> No</span>
                                )}
                              </td>
                              <td className="p-4 font-mono font-bold text-indigo-600">
                                {(u.balance || 0).toLocaleString()}
                              </td>
                              <td className="p-4 flex items-center gap-2">
                                <button 
                                  onClick={() => {
                                    setAdjustUserId(u.id);
                                    setAdjustAmount('1000');
                                    setActiveTab('wallets');
                                  }}
                                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-xs font-semibold transition"
                                >
                                  Adjust Coins
                                </button>
                                {u.role !== 'admin' && (
                                  <button 
                                    onClick={() => toggleBan(u.id, u.is_banned)}
                                    className={`px-3 py-1 rounded text-xs font-semibold transition ${u.is_banned ? 'bg-green-50 hover:bg-green-100 text-green-700' : 'bg-red-50 hover:bg-red-100 text-red-600'}`}
                                  >
                                    {u.is_banned ? 'Unban' : 'Suspend'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {/* Wallets Adjustment tab */}
                {activeTab === 'wallets' && (
                  <motion.div 
                    key="wallets"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col gap-6"
                  >
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-slate-900">Wallet Management</h2>
                      <p className="text-xs text-slate-500">Perform direct balance adjustments with a mandatory audit record trail</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3">Direct Coin Adjustment</h3>
                        
                        <form onSubmit={handleAdjustment} className="flex flex-col gap-4">
                          <div>
                            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Target User ID</label>
                            <select 
                              value={adjustUserId || ''} 
                              onChange={e => setAdjustUserId(e.target.value ? Number(e.target.value) : null)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="">Select User</option>
                              {users.map(u => (
                                <option key={u.id} value={u.id}>{u.name} (Current: {u.balance} Coins)</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Coin Delta Adjustment (Positive or Negative)</label>
                            <input 
                              type="text" 
                              value={adjustAmount} 
                              onChange={e => setAdjustAmount(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                              placeholder="e.g. 500 or -250"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Reason (Required for audit log)</label>
                            <input 
                              type="text" 
                              value={adjustReason} 
                              onChange={e => setAdjustReason(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="Loyalty match or technical correction"
                            />
                          </div>

                          <button 
                            type="submit" 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg text-xs transition duration-150 flex items-center justify-center gap-1 shadow-sm"
                          >
                            Submit Adjustment
                          </button>
                        </form>

                        {adjustMsg && <p className="text-xs text-indigo-600 font-semibold font-mono bg-indigo-50 border border-indigo-100 p-2.5 rounded-lg text-center">{adjustMsg}</p>}
                      </div>

                      {/* Audit Ledger summary on side */}
                      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col gap-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3">Ledger Verification Status</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">All adjustments are wrapped inside full Postgres read-row database transaction locks to guarantee exact integrity and prevent double-spend or concurrency leaks.</p>
                        
                        <div className="flex flex-col gap-3">
                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex justify-between items-center">
                            <span className="text-xs font-medium text-slate-600">Starting default:</span>
                            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">+1000 Coins / signup</span>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex justify-between items-center">
                            <span className="text-xs font-medium text-slate-600">Concurrency Locking:</span>
                            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">SELECT FOR UPDATE</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Transactions tab */}
                {activeTab === 'transactions' && (
                  <motion.div 
                    key="transactions"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col gap-6"
                  >
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-slate-900">Transaction Ledger</h2>
                      <p className="text-xs text-slate-500">Full audit log of game bets, game winnings, and manual back-office coin adjustments</p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-bold">
                            <th className="py-3.5 px-4">Transaction ID</th>
                            <th className="py-3.5 px-4">User</th>
                            <th className="py-3.5 px-4">Type</th>
                            <th className="py-3.5 px-4">Amount</th>
                            <th className="py-3.5 px-4">Status</th>
                            <th className="py-3.5 px-4">Reference Note</th>
                            <th className="py-3.5 px-4">Date</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-600">
                          {transactions.map((tx) => (
                            <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                              <td className="p-4 font-mono font-bold text-slate-400">#TX-{tx.id}</td>
                              <td className="p-4 font-semibold text-slate-850">{tx.user_name || `User ID: ${tx.user_id}`}</td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${tx.type === 'win' ? 'bg-green-100 text-green-700' : tx.type === 'bet' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                  {tx.type}
                                </span>
                              </td>
                              <td className="p-4 font-mono font-bold text-slate-850">
                                {tx.amount.toLocaleString()} Coins
                              </td>
                              <td className="p-4">
                                <span className="text-green-600 flex items-center gap-1 font-semibold text-[11px]">
                                  <CheckCircle className="w-3.5 h-3.5 text-green-500" /> {tx.status}
                                </span>
                              </td>
                              <td className="p-4 text-slate-500">{tx.reference_note || '-'}</td>
                              <td className="p-4 text-slate-400 font-mono text-[10px]">{new Date(tx.created_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {/* Limbo tab */}
                {activeTab === 'limbo' && (
                  <motion.div 
                    key="limbo"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col gap-6"
                  >
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-slate-900">Limbo Game Auditing</h2>
                      <p className="text-xs text-slate-500">Verify game outcomes using the server seed SHA-256 commit system</p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-bold">
                            <th className="py-3.5 px-4">Round ID</th>
                            <th className="py-3.5 px-4">Player</th>
                            <th className="py-3.5 px-4">Bet Amount</th>
                            <th className="py-3.5 px-4">Committed Server Seed Hash</th>
                            <th className="py-3.5 px-4">Revealed Server Seed</th>
                            <th className="py-3.5 px-4">Client Seed</th>
                            <th className="py-3.5 px-4">Multiplier Outcome</th>
                            <th className="py-3.5 px-4">Result</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-600">
                          {limboRounds.map((r) => (
                            <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                              <td className="p-4 font-mono font-bold text-slate-400">#LM-{r.id}</td>
                              <td className="p-4 font-semibold text-slate-850">{r.user_name || `User ID: ${r.user_id}`}</td>
                              <td className="p-4 font-mono text-slate-500">{r.bet_amount}</td>
                              <td className="p-4 font-mono text-[10px] text-slate-400 truncate max-w-xs" title={r.server_seed_hash}>
                                {r.server_seed_hash.substring(0, 16)}...
                              </td>
                              <td className="p-4 font-mono text-[10px] text-indigo-600 truncate max-w-xs" title={r.server_seed}>
                                {r.server_seed.substring(0, 16)}...
                              </td>
                              <td className="p-4 font-mono text-[10px] text-slate-500">{r.client_seed}</td>
                              <td className="p-4 font-mono font-bold text-slate-850">{r.result_multiplier}x</td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${r.win ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {r.win ? 'WIN' : 'LOSE'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {/* Card Game Tables tab */}
                {activeTab === 'table-games' && (
                  <motion.div 
                    key="table-games"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col gap-6"
                  >
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-slate-900">Card Table Histories</h2>
                      <p className="text-xs text-slate-500">Read-only logging of Rummy and Poker tables, completed scores, and distributed winnings</p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-bold">
                            <th className="py-3.5 px-4">Table ID</th>
                            <th className="py-3.5 px-4">Game Type</th>
                            <th className="py-3.5 px-4">Seated Players</th>
                            <th className="py-3.5 px-4">Winner Name</th>
                            <th className="py-3.5 px-4">Pot Size</th>
                            <th className="py-3.5 px-4">Evaluated Results Data</th>
                            <th className="py-3.5 px-4">Created At</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-600">
                          {tableHistories.map((h) => (
                            <tr key={h.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                              <td className="p-4 font-mono font-bold text-slate-400">{h.table_id}</td>
                              <td className="p-4">
                                <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-amber-100 text-amber-700">
                                  {h.game_type}
                                </span>
                              </td>
                              <td className="p-4 text-slate-600">
                                {Array.isArray(h.players) ? h.players.join(', ') : h.players}
                              </td>
                              <td className="p-4 text-green-600 font-bold">{h.winner_name || `User ID: ${h.winner_user_id}`}</td>
                              <td className="p-4 font-mono text-slate-800 font-bold">{h.bet_amount} Coins</td>
                              <td className="p-4 max-w-sm">
                                <pre className="text-[10px] font-mono text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100 max-h-32 overflow-y-auto">
                                  {JSON.stringify(h.result_data, null, 2)}
                                </pre>
                              </td>
                              <td className="p-4 text-slate-400 font-mono text-[10px]">{new Date(h.created_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {/* Interactive API Explorer & Tester */}
                {activeTab === 'api-tester' && (
                  <motion.div 
                    key="api-tester"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col gap-6"
                  >
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans">Interactive API Explorer</h2>
                      <p className="text-xs text-slate-500">Trigger standard player API calls directly to verify responses, auth tokens, and wallet state</p>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {/* Test Controller Panel */}
                      <div className="flex flex-col gap-4">
                        {/* Section 1: Signup & Auth */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                          <div className="text-[11px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-2 border-b border-slate-100 pb-2">
                            <Lock className="w-3.5 h-3.5 text-indigo-600" /> Player Registration & Login
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button 
                              onClick={() => testEndpoint('POST', '/api/register', { name: 'Gamer One', email: 'gamer1@velas.com', password: 'password123', age_verified: true })}
                              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs px-3 py-1.5 rounded-lg transition-colors font-mono text-indigo-600 font-semibold"
                            >
                              POST /api/register
                            </button>
                            <button 
                              onClick={() => testEndpoint('POST', '/api/login', { email: 'gamer1@velas.com', password: 'password123' })}
                              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs px-3 py-1.5 rounded-lg transition-colors font-mono text-indigo-600 font-semibold"
                            >
                              POST /api/login
                            </button>
                            <button 
                              onClick={() => testEndpoint('GET', '/api/user/profile')}
                              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs px-3 py-1.5 rounded-lg transition-colors font-mono text-indigo-600 font-semibold"
                            >
                              GET /api/user/profile
                            </button>
                          </div>
                        </div>

                        {/* Section 2: Wallet */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                          <div className="text-[11px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-2 border-b border-slate-100 pb-2">
                            <WalletIcon className="w-3.5 h-3.5 text-indigo-600" /> Virtual Wallet Balance
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button 
                              onClick={() => testEndpoint('GET', '/api/wallet/balance')}
                              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs px-3 py-1.5 rounded-lg transition-colors font-mono text-indigo-600 font-semibold"
                            >
                              GET /api/wallet/balance
                            </button>
                            <button 
                              onClick={() => testEndpoint('GET', '/api/transactions/history')}
                              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs px-3 py-1.5 rounded-lg transition-colors font-mono text-indigo-600 font-semibold"
                            >
                              GET /api/transactions/history
                            </button>
                          </div>
                        </div>

                        {/* Section 3: Limbo Game */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                          <div className="text-[11px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-2 border-b border-slate-100 pb-2">
                            <Play className="w-3.5 h-3.5 text-emerald-600" /> Limbo (Provably Fair Play)
                          </div>
                          <div className="grid grid-cols-3 gap-2 pt-1">
                            <div>
                              <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Bet Amount</label>
                              <input type="text" value={limboBet} onChange={e => setLimboBet(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500" />
                            </div>
                            <div>
                              <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Target Multiplier</label>
                              <input type="text" value={limboTarget} onChange={e => setLimboTarget(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500" />
                            </div>
                            <div>
                              <label className="text-[9px] uppercase font-bold text-slate-500 block mb-0.5">Client Seed</label>
                              <input type="text" value={limboClientSeed} onChange={e => setLimboClientSeed(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500" />
                            </div>
                          </div>
                          <button 
                            onClick={() => testEndpoint('POST', '/api/game/limbo/play', { bet_amount: limboBet, target_multiplier: limboTarget, client_seed: limboClientSeed })}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4 py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 shadow-sm mt-2"
                          >
                            <Play className="w-4 h-4 fill-current" /> Play Limbo Game
                          </button>
                        </div>

                        {/* Section 4: Card Tables */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                          <div className="text-[11px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-2 border-b border-slate-100 pb-2">
                            <Maximize2 className="w-3.5 h-3.5 text-amber-600" /> Multiplayer Tables (Poker / Rummy)
                          </div>
                          <div className="flex gap-2 pt-1">
                            <select value={tableGameType} onChange={e => setTableGameType(e.target.value as any)} className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-800 font-semibold focus:ring-1 focus:ring-indigo-500">
                              <option value="poker">Poker</option>
                              <option value="rummy">Rummy</option>
                            </select>
                            <button 
                              onClick={async () => {
                                try {
                                  const res = await fetch('/api/game/table/create', {
                                    method: 'POST',
                                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ game_type: tableGameType })
                                  }).then(r => r.json());
                                  setApiResponse(res);
                                  if (res.table && res.table.id) {
                                    setSelectedTableId(res.table.id);
                                  }
                                } catch (err: any) {
                                  setApiResponse({ error: err.toString() });
                                }
                              }}
                              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs px-3 py-1.5 rounded-lg transition text-indigo-600 font-semibold"
                            >
                              Create Game Table
                            </button>
                          </div>

                          {selectedTableId && (
                            <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
                              <div className="text-xs font-mono text-slate-600">Active Table: <span className="text-indigo-600 font-bold">{selectedTableId}</span></div>
                              <div className="flex flex-wrap gap-1.5">
                                <button 
                                  onClick={() => testEndpoint('POST', `/api/game/table/${selectedTableId}/join`)}
                                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] px-2.5 py-1 rounded font-semibold transition text-slate-700"
                                >
                                  Join Table
                                </button>
                                <button 
                                  onClick={() => testEndpoint('GET', `/api/game/table/${selectedTableId}/my-cards`)}
                                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] px-2.5 py-1 rounded font-semibold transition text-slate-700"
                                >
                                  Get My Cards
                                </button>
                                <button 
                                  onClick={() => testEndpoint('POST', `/api/game/table/${selectedTableId}/action`, { action: 'draw' })}
                                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] px-2.5 py-1 rounded font-semibold transition text-slate-700"
                                >
                                  Draw Card
                                </button>
                                <button 
                                  onClick={() => testEndpoint('POST', `/api/game/table/${selectedTableId}/action`, { action: 'declare' })}
                                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] px-2.5 py-1 rounded font-semibold transition text-slate-700"
                                >
                                  Declare Winner
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Section 5: Utilities */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                          <div className="text-[11px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-2 border-b border-slate-100 pb-2">
                            <RefreshCw className="w-3.5 h-3.5 text-indigo-600" /> Platform Utilities
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button 
                              onClick={() => testEndpoint('GET', '/api/currency-rates')}
                              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs px-3 py-1.5 rounded-lg transition text-indigo-600 font-semibold"
                            >
                              GET /api/currency-rates
                            </button>
                            <button 
                              onClick={() => testEndpoint('GET', '/api/chat-config')}
                              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs px-3 py-1.5 rounded-lg transition text-indigo-600 font-semibold"
                            >
                              GET /api/chat-config
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Console Logger Output */}
                      <div className="flex flex-col gap-3 h-full">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl flex-1 flex flex-col overflow-hidden min-h-[450px] shadow-lg">
                          <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">API Stream Console</span>
                            {apiEndpoint && <span className="text-[10px] font-mono text-indigo-400 font-bold">{apiEndpoint}</span>}
                          </div>

                          <div className="p-4 flex-1 overflow-y-auto font-mono text-[11px] flex flex-col gap-4">
                            {apiPayload && (
                              <div>
                                <div className="text-slate-500 mb-1 text-[10px] uppercase font-bold tracking-wider">// Request Payload</div>
                                <pre className="bg-slate-950/50 p-3 rounded-lg border border-slate-850 text-slate-300 whitespace-pre-wrap">{apiPayload}</pre>
                              </div>
                            )}

                            <div>
                              <div className="text-slate-500 mb-1 text-[10px] uppercase font-bold tracking-wider">// Response JSON</div>
                              {apiResponse ? (
                                <pre className="bg-slate-950/50 p-3 rounded-lg border border-slate-850 text-green-400 whitespace-pre-wrap">
                                  {JSON.stringify(apiResponse, null, 2)}
                                </pre>
                              ) : (
                                <div className="text-slate-600 italic">No request triggered yet. Click one of the endpoints on the left.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>

          {/* PERSISTENT PLATFORM FOOTER */}
          <footer className="mt-auto h-12 border-t border-slate-200 bg-white flex items-center px-6 lg:px-8 justify-between text-[10px] text-slate-400 uppercase font-medium tracking-widest" id="footer_section">
            <div>Environment: production • Velas Game Server Active</div>
            <div className="flex gap-4">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> CPU: 12%</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> RAM: 4.2GB</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
