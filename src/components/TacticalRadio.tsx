import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useRealtimeVoiceChat } from '../hooks/useRealtimeVoiceChat';
import {
  Radio,
  Mic,
  MicOff,
  Volume2,
  Users,
  User,
  ChevronUp,
  ChevronDown,
  Lock,
  Headphones,
  RadioTower,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

export const TacticalRadio: React.FC = () => {
  const {
    roomCode,
    currentUser,
    players,
    gameState,
    radioTarget,
    setRadioTarget,
    registerWebRTCSignalListener,
  } = useGame();

  const [isExpanded, setIsExpanded] = useState(true);

  // Active fellow hiders (excluding current user)
  const fellowHiders = players.filter(
    (p) => p.role === 'HIDER' && p.status === 'ACTIVE' && p.id !== currentUser?.id
  );

  const {
    hasMicAccess,
    isLiveConnected,
    isTalking,
    isOpenMic,
    audioLevel,
    activeSpeakerName,
    errorMessage,
    audioUnlocked,
    unlockAudio,
    requestMicAccess,
    startTalking,
    stopTalking,
    toggleOpenMic,
    handleIncomingSignal,
  } = useRealtimeVoiceChat({
    roomCode,
    currentUser,
    players,
    targetType: radioTarget.type,
    targetPlayerId: radioTarget.targetPlayerId,
  });

  // Wire incoming WebRTC signalling packets from SSE
  useEffect(() => {
    const unregister = registerWebRTCSignalListener((packet) => {
      handleIncomingSignal(packet);
    });
    return unregister;
  }, [registerWebRTCSignalListener, handleIncomingSignal]);

  // STRICT MILITARY SECURITY CHECK: Only active hiders have radio clearance!
  if (
    !currentUser ||
    currentUser.role !== 'HIDER' ||
    currentUser.status !== 'ACTIVE' ||
    (gameState !== 'HIDING' && gameState !== 'ACTIVE_SEEKING')
  ) {
    return null;
  }

  const isDirect = radioTarget.type === 'DIRECT';
  const selectedTargetPlayer = isDirect
    ? fellowHiders.find((p) => p.id === radioTarget.targetPlayerId)
    : null;

  return (
    <div className="absolute bottom-16 sm:bottom-18 right-2.5 sm:right-4 z-40 max-w-sm pointer-events-auto select-none">
      {/* Minimized Quick-Bar View */}
      {!isExpanded ? (
        <button
          onClick={() => {
            unlockAudio();
            setIsExpanded(true);
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border shadow-2xl backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
            activeSpeakerName
              ? 'bg-amber-950/95 border-amber-500 text-amber-300 animate-pulse'
              : isTalking
              ? 'bg-red-950/95 border-red-500 text-red-300 ring-2 ring-red-500/50'
              : 'bg-slate-900/95 border-emerald-500/60 text-emerald-400'
          }`}
          title="Open Real-Time Squad Intercom"
        >
          <div className="relative">
            <Radio className="w-4 h-4" />
            <span
              className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                activeSpeakerName
                  ? 'bg-amber-400 animate-ping'
                  : isTalking
                  ? 'bg-red-400 animate-ping'
                  : 'bg-emerald-400'
              }`}
            />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-mono text-[10px] font-black uppercase tracking-wider">
              {activeSpeakerName
                ? `VOICE: ${activeSpeakerName}`
                : isTalking
                ? 'TRANSMITTING LIVE'
                : 'REAL-TIME COMMS'}
            </span>
            <span className="font-mono text-[9px] text-slate-400">
              {isDirect ? `DIRECT: ${selectedTargetPlayer?.name || 'OPERATIVE'}` : 'SQUAD NET (ALL)'}
            </span>
          </div>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 ml-1" />
        </button>
      ) : (
        /* Expanded Tactical Real-Time Intercom Panel */
        <div className="bg-slate-950/95 border-2 border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-3 w-72 sm:w-80 flex flex-col gap-2.5 text-xs animate-in fade-in zoom-in-95 duration-200">
          {/* Radio Header & Minimizer */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-emerald-950 border border-emerald-600 text-emerald-400">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div>
                <div className="font-mono font-black text-xs text-white tracking-wider flex items-center gap-1.5">
                  <span>HIDER LIVE COMMS</span>
                  <span className="text-[9px] font-mono text-emerald-400 px-1 py-0.2 rounded bg-emerald-950/80 border border-emerald-800">
                    REAL-TIME
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  Sub-50ms peer mesh. Seekers cannot hear.
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsExpanded(false)}
              className="text-slate-400 hover:text-white p-1"
              title="Minimize Radio"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Active Incoming Voice Transmission Alert */}
          {activeSpeakerName && (
            <div className="p-2 rounded-xl bg-amber-950/90 border border-amber-500/80 text-amber-200 flex items-center justify-between shadow-lg animate-pulse">
              <div className="flex items-center gap-2 min-w-0">
                <Volume2 className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                <div className="min-w-0">
                  <div className="font-mono font-black text-[11px] uppercase truncate">
                    {activeSpeakerName} SPEAKING LIVE
                  </div>
                  <div className="text-[10px] font-mono text-amber-300/80 truncate">
                    {isDirect ? 'Direct Line (Private)' : 'Squad Net (All Hiders)'}
                  </div>
                </div>
              </div>

              {/* Real-Time Live Waveform Equalizer */}
              <div className="flex items-end gap-0.5 h-4 shrink-0 pl-1">
                <span className="w-1 bg-amber-400 h-3 animate-pulse" />
                <span className="w-1 bg-amber-300 h-4 animate-bounce" />
                <span className="w-1 bg-amber-400 h-2 animate-pulse" />
                <span className="w-1 bg-amber-200 h-3.5 animate-bounce" />
              </div>
            </div>
          )}

          {/* Frequency Selector: Squad Net (Group) vs Direct (1-to-1) */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono font-bold uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>FREQUENCY CHANNEL:</span>
              <span className="text-emerald-400 font-semibold">
                {fellowHiders.length} HIDERS ONLINE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
              <button
                onClick={() => setRadioTarget({ type: 'GROUP' })}
                className={`py-1.5 px-2 rounded-lg border font-bold flex items-center justify-center gap-1.5 transition-all ${
                  !isDirect
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>SQUAD NET (ALL)</span>
              </button>

              <button
                onClick={() => {
                  if (fellowHiders.length > 0) {
                    setRadioTarget({
                      type: 'DIRECT',
                      targetPlayerId: fellowHiders[0].id,
                      targetPlayerName: fellowHiders[0].name,
                    });
                  }
                }}
                disabled={fellowHiders.length === 0}
                className={`py-1.5 px-2 rounded-lg border font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 ${
                  isDirect
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-950/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>DIRECT (1-TO-1)</span>
              </button>
            </div>

            {/* If Direct is selected, show list of active fellow hiders */}
            {isDirect && (
              <div className="pt-1">
                {fellowHiders.length === 0 ? (
                  <div className="text-[11px] text-slate-500 font-mono italic text-center py-1">
                    No other active hiders online
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-cyan-400 font-semibold flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>SELECT TARGET OPERATIVE:</span>
                    </label>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                      {fellowHiders.map((hider) => {
                        const isSelected = radioTarget.targetPlayerId === hider.id;
                        return (
                          <button
                            key={hider.id}
                            onClick={() =>
                              setRadioTarget({
                                type: 'DIRECT',
                                targetPlayerId: hider.id,
                                targetPlayerName: hider.name,
                              })
                            }
                            className={`px-2.5 py-1 rounded border font-mono text-[10px] font-bold whitespace-nowrap transition-all ${
                              isSelected
                                ? 'bg-cyan-600 border-cyan-300 text-slate-950 shadow'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            {hider.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Microphone Permission Prompt if not yet approved */}
          {!hasMicAccess ? (
            <button
              onClick={requestMicAccess}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg active:scale-95 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>ENABLE MICROPHONE & LIVE AUDIO</span>
            </button>
          ) : (
            /* Tactical Live Controls: Instant PTT + Open-Mic Toggle */
            <div className="space-y-2 pt-1">
              {/* Push-to-Talk Main Trigger */}
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  startTalking();
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  stopTalking();
                }}
                onPointerLeave={() => {
                  if (isTalking && !isOpenMic) stopTalking();
                }}
                onPointerCancel={() => {
                  if (isTalking && !isOpenMic) stopTalking();
                }}
                className={`w-full py-3.5 sm:py-4 rounded-xl border-2 font-mono font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all select-none touch-none shadow-2xl cursor-pointer ${
                  isTalking
                    ? 'bg-red-600 border-white text-white shadow-red-950/80 scale-[0.98] ring-4 ring-red-500/50'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-emerald-400 text-slate-950'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    isTalking ? 'bg-white text-red-600 animate-ping' : 'bg-slate-950 text-emerald-400'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                </div>

                <div className="flex flex-col items-start leading-tight">
                  <span className="text-xs sm:text-sm">
                    {isTalking ? 'TRANSMITTING LIVE (SPEAK NOW)' : 'HOLD TO TALK (LIVE PTT)'}
                  </span>
                  <span
                    className={`text-[9px] font-mono ${
                      isTalking ? 'text-red-200' : 'text-slate-900/80 font-bold'
                    }`}
                  >
                    {isTalking
                      ? 'LIVE REAL-TIME STREAM ACTIVE'
                      : isDirect
                      ? `PRIVATE TO ${selectedTargetPlayer?.name || 'OPERATIVE'}`
                      : 'INSTANT LIVE MESH TO SQUAD'}
                  </span>
                </div>
              </button>

              {/* Mode Bar: Open-Mic Hands-Free Mode + Live Decibel Meter */}
              <div className="flex items-center justify-between gap-2 px-1">
                {/* Hands-Free Open-Mic Toggle */}
                <button
                  onClick={toggleOpenMic}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-[10px] font-bold transition-all cursor-pointer ${
                    isOpenMic
                      ? 'bg-red-950/80 border-red-500 text-red-300 ring-1 ring-red-500'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Toggle hands-free continuous open mic"
                >
                  {isOpenMic ? <Mic className="w-3 h-3 text-red-400" /> : <MicOff className="w-3 h-3" />}
                  <span>{isOpenMic ? 'OPEN MIC: ON' : 'HANDS-FREE'}</span>
                </button>

                {/* Live Mic Level Visualizer */}
                <div className="flex items-center gap-1.5 flex-1 max-w-[130px] bg-slate-900/90 border border-slate-800 px-2 py-1 rounded-lg">
                  <span className="text-[9px] font-mono text-slate-400">MIC:</span>
                  <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-75 ${
                        isTalking ? (audioLevel > 50 ? 'bg-red-400' : 'bg-emerald-400') : 'bg-slate-600'
                      }`}
                      style={{ width: `${isTalking ? Math.max(10, audioLevel) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Audio Unlocked Confirmation / Reminder */}
          {!audioUnlocked && (
            <button
              onClick={unlockAudio}
              className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-700/80 text-cyan-300 text-[10px] font-mono flex items-center justify-center gap-1.5 hover:bg-cyan-900/80 cursor-pointer"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Tap here to enable incoming speaker audio</span>
            </button>
          )}

          {errorMessage && (
            <div className="p-2 rounded bg-red-950/80 border border-red-700 text-red-300 text-[10px] font-mono flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
