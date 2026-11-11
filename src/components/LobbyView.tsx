import React, { useState, useEffect } from 'react';
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
  Smartphone,
  Wifi,
  Crown,
  Edit2,
  User,
  Sparkles,
  Activity,
  Eye,
} from 'lucide-react';
import { TerminateMatchModal } from './TerminateMatchModal';

export const LobbyView: React.FC = () => {
  const {
    roomCode,
    currentUser,
    players,
    isHost,
    headStartMinutes,
    gameDurationMinutes,
    pingIntervalSeconds,
    revealDurationSeconds,
    setHeadStartMinutes,
    setGameDurationMinutes,
    setPingIntervalSeconds,
    setRevealDurationSeconds,
    startGame,
    createRoom,
    joinRoom,
    addSimulatedBot,
    removePlayer,
    shareableUrl,
    updatePlayerName,
  } = useGame();

  const [inputName, setInputName] = useState(currentUser?.name || '');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'LOBBY' | 'JOIN_CREATE'>('LOBBY');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showTerminateModal, setShowTerminateModal] = useState(false);

  // In-lobby name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(currentUser?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Slider debounced states to avoid network flooding
  const [localHeadStart, setLocalHeadStart] = useState(headStartMinutes);
  const [localGameDuration, setLocalGameDuration] = useState(gameDurationMinutes);
  const [localPingInterval, setLocalPingInterval] = useState(pingIntervalSeconds);
  const [localRevealDuration, setLocalRevealDuration] = useState(revealDurationSeconds);

  useEffect(() => {
    setLocalHeadStart(headStartMinutes);
  }, [headStartMinutes]);

  useEffect(() => {
    setLocalGameDuration(gameDurationMinutes);
  }, [gameDurationMinutes]);

  useEffect(() => {
    setLocalPingInterval(pingIntervalSeconds);
  }, [pingIntervalSeconds]);

  useEffect(() => {
    setLocalRevealDuration(revealDurationSeconds);
  }, [revealDurationSeconds]);

  useEffect(() => {
    if (currentUser?.name) {
      setInputName(currentUser.name);
      setEditNameValue(currentUser.name);
    }
  }, [currentUser?.name]);

  const handleCreateNewRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = inputName.trim() || 'Host Operator';
    await createRoom(finalName);
    setActiveTab('LOBBY');
  };

  const handleJoinExistingRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim() || !joinCodeInput.trim()) return;
    setJoining(true);
    setJoinError(null);
    const success = await joinRoom(joinCodeInput.trim(), inputName.trim());
    setJoining(false);
    if (success) {
      setActiveTab('LOBBY');
    } else {
      setJoinError('Failed to connect to room. Please verify the code.');
    }
  };

  const handleSaveInLobbyName = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = editNameValue.trim();
    if (!finalName) return;
    setSavingName(true);
    await updatePlayerName(finalName);
    setSavingName(false);
    setIsEditingName(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleShareInviteLink = async () => {
    const inviteUrl = shareableUrl;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join ShadowPulse Tactical Hide & Seek Match',
          text: `Join my live Hide & Seek game! Room Code: ${roomCode}`,
          url: inviteUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const hostPlayer = players.find((p) => p.isHost);

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6 flex flex-col gap-5">
      {/* Title & Tactical Brief */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold tracking-widest uppercase">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          Real-Time Live Multiplayer GPS
        </div>
        <h1 className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
          SHADOW<span className="text-emerald-400">PULSE</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
          Multi-device outdoor game with periodic 5-minute radar pings, 30s warnings, and 10s live GPS flash reveals.
        </p>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-mono">
        <button
          onClick={() => setActiveTab('LOBBY')}
          className={`flex-1 py-2 font-bold text-center border-b-2 transition-colors ${
            activeTab === 'LOBBY'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          ACTIVE ROOM ({players.length} PLAYERS)
        </button>
        <button
          onClick={() => setActiveTab('JOIN_CREATE')}
          className={`flex-1 py-2 font-bold text-center border-b-2 transition-colors ${
            activeTab === 'JOIN_CREATE'
              ? 'border-emerald-400 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          JOIN OR CREATE NEW ROOM
        </button>
      </div>

      {activeTab === 'JOIN_CREATE' ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
          {/* Operative Call-Sign Configuration */}
          <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="playerNameInput" className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Your Operative Call-Sign (Visible to All)</span>
              </label>
              <span className="text-[10px] font-mono text-slate-400">Max 20 chars</span>
            </div>
            <input
              id="playerNameInput"
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="e.g. Ghost, Maverick, ShadowFox, Viper"
              maxLength={20}
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-sm font-bold focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-400">
              This name will be displayed on the tactical map radar pins and in the player roster.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Create Room Button */}
            <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-col justify-between gap-3">
              <div>
                <h3 className="font-mono font-bold text-sm text-slate-200">Host New Match</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Generates a new room code and grants Host timer controls.
                </p>
              </div>
              <button
                onClick={handleCreateNewRoom}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-emerald-950"
              >
                Create Room As &quot;{inputName.trim() || 'Host'}&quot;
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
                {joinError && <div className="text-[10px] text-red-400 mt-1">{joinError}</div>}
              </div>
              <button
                onClick={handleJoinExistingRoom}
                disabled={joining || !joinCodeInput.trim()}
                className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-mono font-bold text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
              >
                {joining ? 'Connecting...' : `Join Room As "${inputName.trim() || 'Operative'}"`}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Visible Call-Sign Customization Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold tracking-wider">
                  YOUR VISIBLE CALL-SIGN
                </div>

                {isEditingName ? (
                  <form onSubmit={handleSaveInLobbyName} className="flex flex-wrap items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      maxLength={20}
                      autoFocus
                      className="px-2.5 py-1 rounded bg-slate-950 border border-emerald-500 text-sm font-mono text-white font-bold focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={savingName || !editNameValue.trim()}
                      className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs"
                    >
                      {savingName ? 'SAVING...' : 'SAVE'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(false)}
                      className="px-2 py-1 text-slate-400 hover:text-white text-xs font-mono"
                    >
                      CANCEL
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-lg sm:text-xl font-bold text-slate-100">
                      {currentUser?.name || 'Operative-1'}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800">
                      VISIBLE TO ALL
                    </span>
                    {savedSuccess && (
                      <span className="text-[10px] font-mono text-emerald-400 animate-pulse">
                        ✓ Saved & Synced!
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!isEditingName && (
              <button
                onClick={() => {
                  setEditNameValue(currentUser?.name || '');
                  setIsEditingName(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-center"
                title="Change your operative call-sign"
              >
                <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>CHANGE NAME</span>
              </button>
            )}
          </div>

          {/* Room Header with Code & Direct Multi-Device Share */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-slate-400 font-semibold tracking-wider">
                  <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span>LIVE MULTIPLAYER ROOM</span>
                </div>
                <div className="font-mono text-3xl font-black text-emerald-400 tracking-widest">
                  {roomCode}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 sm:flex-row">
                {/* Share Full Invite Link */}
                <button
                  onClick={handleShareInviteLink}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono font-bold text-xs transition-colors shadow active:scale-95"
                  title="Share invite link with friends"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'LINK COPIED!' : 'SHARE LINK'}</span>
                </button>

                {/* Copy Code Only */}
                <button
                  onClick={handleCopyCode}
                  className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-xs transition-colors active:scale-95"
                  title="Copy 6-digit code"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{copiedCode ? 'COPIED' : 'CODE'}</span>
                </button>
              </div>
            </div>

            {/* Multi-Device instruction hint banner */}
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-sans text-slate-300 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>
                <strong>Multi-Device Ready:</strong> Share the link or room code with friends on their phones. When they join, they will appear in this roster in real time!
              </span>
            </div>
          </div>

          {/* Connected Players Roster */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h2 className="font-mono font-bold text-xs uppercase tracking-wider text-slate-200">
                  CONNECTED OPERATIVES ({players.length})
                </h2>
              </div>

              {/* Bot Simulation Quick Buttons */}
              {isHost && (
                <button
                  onClick={addSimulatedBot}
                  aria-label="Add simulated AI player"
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-mono transition-colors"
                  title="Add an AI Bot for testing"
                >
                  <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>+ ADD AI BOT</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-800/80 max-h-56 overflow-y-auto">
              {players.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 font-mono">
                  Connecting to room...
                </div>
              ) : (
                players.map((p) => {
                  const isMe = p.id === currentUser?.id;
                  return (
                    <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <div>
                          <div className="font-mono font-semibold text-slate-100 flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {isMe && <span className="text-emerald-400 font-bold text-[10px]">(YOU)</span>}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {p.isHost ? 'Host & Commander' : p.isBot ? 'Simulated AI Player' : 'Live Player'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {p.isHost && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950 border border-amber-700 text-[10px] font-mono text-amber-300 font-bold">
                            <Crown className="w-3 h-3 text-amber-400" />
                            <span>HOST</span>
                          </span>
                        )}
                        {p.isBot && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400">
                            AI BOT
                          </span>
                        )}

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
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Timer Configuration Sliders (Host Only) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <h2 className="font-mono font-bold text-xs uppercase tracking-wider text-slate-200">
                  MATCH TIMERS {isHost ? '(HOST CONTROLS)' : '(SET BY HOST)'}
                </h2>
              </div>
              {!isHost && hostPlayer && (
                <span className="text-[10px] font-mono text-slate-400">
                  Managed by {hostPlayer.name}
                </span>
              )}
            </div>

            {/* Slider 1: Head-Start Timer (1 to 15 minutes) */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  Hiding Head-Start:
                </span>
                <span className="text-emerald-400 font-bold text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {localHeadStart} MIN
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                step={1}
                value={localHeadStart}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setLocalHeadStart(val);
                  if (isHost) setHeadStartMinutes(val);
                }}
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
                  {localGameDuration} MIN
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={90}
                step={5}
                value={localGameDuration}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setLocalGameDuration(val);
                  if (isHost) setGameDurationMinutes(val);
                }}
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

            {/* Slider 3: Radar Ping Frequency (30s to 10 mins) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  Radar Ping Reveal Frequency:
                </span>
                <span className="text-amber-400 font-bold text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {localPingInterval < 60
                    ? `${localPingInterval}s`
                    : localPingInterval % 60 === 0
                    ? `${localPingInterval / 60} MIN`
                    : `${Math.floor(localPingInterval / 60)}m ${localPingInterval % 60}s`}
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={600}
                step={15}
                value={localPingInterval}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setLocalPingInterval(val);
                  if (isHost) setPingIntervalSeconds(val);
                }}
                disabled={!isHost}
                className="w-full accent-amber-500 cursor-pointer disabled:opacity-60"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>30s</span>
                <span>1m</span>
                <span>2m</span>
                <span>5m (Std)</span>
                <span>10m</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Time interval between location reveal cycles. Seeker map stays dark between cycles.
              </p>
            </div>

            {/* Slider 4: Reveal Flash Duration (3s to 30s) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-rose-400" />
                  Live Reveal Flash Duration:
                </span>
                <span className="text-rose-400 font-bold text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {localRevealDuration}s FLASH
                </span>
              </div>
              <input
                type="range"
                min={3}
                max={30}
                step={1}
                value={localRevealDuration}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setLocalRevealDuration(val);
                  if (isHost) setRevealDurationSeconds(val);
                }}
                disabled={!isHost}
                className="w-full accent-rose-500 cursor-pointer disabled:opacity-60"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>3s</span>
                <span>5s</span>
                <span>10s (Std)</span>
                <span>20s</span>
                <span>30s</span>
              </div>
              <p className="text-[11px] text-slate-400">
                How many seconds hider coordinates flash visibly on the radar before vanishing.
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
                  ? 'NEED AT LEAST 2 PLAYERS (ADD BOT OR SHARE LINK)'
                  : isHost
                  ? 'START MATCH (ASSIGN RANDOM DENNER)'
                  : 'WAITING FOR HOST TO START MATCH...'}
              </span>
            </button>
            <p className="text-center text-[11px] font-mono text-slate-500 mt-2">
              Selecting Start randomly assigns 1 player as Denner (Seeker) and everyone else as Hiders across all devices.
            </p>

            {/* Host Emergency Match Termination & Wipe Option */}
            {isHost && (
              <div className="pt-3 border-t border-slate-800/80 mt-3 text-center">
                <button
                  onClick={() => setShowTerminateModal(true)}
                  className="w-full py-2.5 rounded-xl bg-red-950/30 hover:bg-red-950/80 border border-red-800/80 text-red-300 hover:text-red-200 font-mono font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>TERMINATE MATCH & WIPE SERVER DATA</span>
                </button>
                <p className="text-[10px] font-mono text-slate-500 mt-1">
                  Permanently deletes room, player records, and coordinates from server
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Host Terminate Modal */}
      {isHost && (
        <TerminateMatchModal
          isOpen={showTerminateModal}
          onClose={() => setShowTerminateModal(false)}
        />
      )}
    </div>
  );
};
