import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import {
  Users,
  Play,
  UserPlus,
  Sliders,
  Shield,
  Clock,
  Radio,
  Zap,
  Trash2,
  Share2,
  Copy,
  Check,
} from 'lucide-react';

export const LobbyView: React.FC = () => {
  const {
    roomCode,
    currentUser,
    players,
    isHost,
    headStartMinutes,
    gameDurationMinutes,
    setHeadStartMinutes,
    setGameDurationMinutes,
    startGame,
    createRoom,
    joinRoom,
    addSimulatedBot,
    removePlayer,
  } = useGame();

  const [inputName, setInputName] = useState(currentUser?.name || '');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'LOBBY' | 'JOIN_CREATE'>('LOBBY');

  const handleCreateNewRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) return;
    createRoom(inputName.trim());
    setActiveTab('LOBBY');
  };

  const handleJoinExistingRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim() || !joinCodeInput.trim()) return;
    joinRoom(joinCodeInput.trim(), inputName.trim());
    setActiveTab('LOBBY');
  };

  const handleShare = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6 flex flex-col gap-5">
      {/* Title & Tactical Brief */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold tracking-widest uppercase">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          Tactical GPS Hide & Seek
        </div>
        <h1 className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
          SHADOW<span className="text-emerald-400">PULSE</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
          Periodic 5-minute radar pings, 30-second warning countdowns, and 10-second live location flash sweeps.
        </p>
      </div>

      {/* Mode Selector Tabs (if player wants to switch room) */}
      <div className="flex border-b border-slate-800 text-xs font-mono">
        <button
          onClick={() => setActiveTab('LOBBY')}
          className={`flex-1 py-2 font-bold text-center border-b-2 transition-colors ${
            activeTab === 'LOBBY'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          ROOM LOBBY ({players.length})
        </button>
        <button
          onClick={() => setActiveTab('JOIN_CREATE')}
          className={`flex-1 py-2 font-bold text-center border-b-2 transition-colors ${
            activeTab === 'JOIN_CREATE'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          JOIN / NEW ROOM
        </button>
      </div>

      {activeTab === 'JOIN_CREATE' ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
          {/* Display Name Input */}
          <div className="space-y-1.5">
            <label htmlFor="playerNameInput" className="text-xs font-mono text-slate-300 font-semibold uppercase">
              Operative Call-Sign / Name
            </label>
            <input
              id="playerNameInput"
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="e.g. Maverick, ShadowFox"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-mono text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Create Room Button */}
            <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-col justify-between gap-3">
              <div>
                <h3 className="font-mono font-bold text-sm text-slate-200">Host New Match</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Generates a new 6-character room code and grants Host timer controls.
                </p>
              </div>
              <button
                onClick={handleCreateNewRoom}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-emerald-950"
              >
                Create Room
              </button>
            </div>

            {/* Join Room Form */}
            <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-col justify-between gap-3">
              <div>
                <h3 className="font-mono font-bold text-sm text-slate-200">Join Existing Room</h3>
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="6-DIGIT CODE"
                  maxLength={6}
                  className="w-full mt-2 px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-center font-mono font-bold text-slate-100 tracking-widest text-sm uppercase focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={handleJoinExistingRoom}
                className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-mono font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
              >
                Join Room
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Room Header with Code */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold tracking-wider">
                ROOM CODE
              </div>
              <div className="font-mono text-2xl font-black text-emerald-400 tracking-widest">
                {roomCode}
              </div>
            </div>

            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-200 transition-colors"
              title="Copy code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span>{copied ? 'COPIED' : 'COPY CODE'}</span>
            </button>
          </div>

          {/* Connected Players Roster */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h2 className="font-mono font-bold text-xs uppercase tracking-wider text-slate-200">
                  CONNECTED PLAYERS ({players.length})
                </h2>
              </div>

              {/* Bot Simulation Quick Buttons */}
              <button
                onClick={addSimulatedBot}
                aria-label="Add simulated AI player"
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-mono transition-colors"
                title="Add an AI Bot for solo testing"
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>+ ADD BOT</span>
              </button>
            </div>

            <div className="divide-y divide-slate-800/80 max-h-48 overflow-y-auto">
              {players.map((p) => {
                const isMe = p.id === currentUser?.id;
                return (
                  <div key={p.id} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-mono font-semibold text-slate-200">
                        {p.name} {isMe && <span className="text-emerald-400 font-bold">(YOU)</span>}
                      </span>
                      {p.isHost && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-950 border border-amber-700 text-[9px] font-mono text-amber-300 font-bold">
                          HOST
                        </span>
                      )}
                      {p.isBot && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[9px] font-mono text-slate-400">
                          AI
                        </span>
                      )}
                    </div>

                    {isHost && !isMe && (
                      <button
                        onClick={() => removePlayer(p.id)}
                        aria-label={`Remove ${p.name}`}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        title="Remove player"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timer Configuration Sliders (Host Only) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <h2 className="font-mono font-bold text-xs uppercase tracking-wider text-slate-200">
                MATCH TIMERS {isHost ? '(HOST CONTROLS)' : '(SET BY HOST)'}
              </h2>
            </div>

            {/* Slider 1: Head-Start Timer (1 to 15 minutes) */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  Hiding Head-Start:
                </span>
                <span className="text-emerald-400 font-bold text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {headStartMinutes} MIN
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                step={1}
                value={headStartMinutes}
                onChange={(e) => isHost && setHeadStartMinutes(parseInt(e.target.value, 10))}
                disabled={!isHost}
                className="w-full accent-emerald-500 cursor-pointer disabled:opacity-60"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>1m</span>
                <span>5m</span>
                <span>10m</span>
                <span>15m</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Denner map is locked/blinded during this head-start phase while Hiders scatter.
              </p>
            </div>

            {/* Slider 2: Game Duration (15 to 90 minutes) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-indigo-400" />
                  Total Game Duration:
                </span>
                <span className="text-indigo-400 font-bold text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {gameDurationMinutes} MIN
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={90}
                step={5}
                value={gameDurationMinutes}
                onChange={(e) => isHost && setGameDurationMinutes(parseInt(e.target.value, 10))}
                disabled={!isHost}
                className="w-full accent-indigo-500 cursor-pointer disabled:opacity-60"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>15m</span>
                <span>30m</span>
                <span>60m</span>
                <span>90m</span>
              </div>
              <p className="text-[11px] text-slate-400">
                If any Hiders remain unfound when this timer expires, Hiders win the match.
              </p>
            </div>
          </div>

          {/* Start Game CTA */}
          <div className="pt-2">
            <button
              onClick={startGame}
              disabled={!isHost || players.length < 2}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-mono font-black text-sm uppercase tracking-wider transition-all active:scale-95 shadow-xl shadow-emerald-950/60 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                {players.length < 2
                  ? 'NEED AT LEAST 2 PLAYERS (ADD BOT)'
                  : isHost
                  ? 'START MATCH (ASSIGN RANDOM DENNER)'
                  : 'WAITING FOR HOST TO START...'}
              </span>
            </button>
            <p className="text-center text-[11px] font-mono text-slate-500 mt-2">
              Selecting Start randomly assigns 1 player as Denner (Seeker) and everyone else as Hiders.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
