import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { useWalkieTalkieRecorder } from '../hooks/useWalkieTalkieRecorder';
import {
  Radio,
  Mic,
  MicOff,
  Volume2,
  Users,
  User,
  ChevronUp,
  ChevronDown,
  Shield,
  Lock,
  Wifi,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

export const TacticalRadio: React.FC = () => {
  const {
    currentUser,
    players,
    gameState,
    radioTarget,
    setRadioTarget,
    activeRadioSpeaker,
    lastRadioTransmission,
    transmitVoiceBurst,
  } = useGame();

  const [isExpanded, setIsExpanded] = useState(true);
  const [handsFreeMode, setHandsFreeMode] = useState(false);

  // Active fellow hiders (excluding current user)
  const fellowHiders = players.filter(
    (p) => p.role === 'HIDER' && p.status === 'ACTIVE' && p.id !== currentUser?.id
  );

  const {
    isRecording,
    recordingSeconds,
    hasMicAccess,
    micPermission,
    errorMessage,
    requestMicAccess,
    startRecording,
    stopRecording,
  } = useWalkieTalkieRecorder({
    onTransmit: transmitVoiceBurst,
  });

  // STRICT SECURITY CHECK: Only active hiders have radio access!
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
      {/* Minimized Pill View */}
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border shadow-2xl backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
            activeRadioSpeaker
              ? 'bg-amber-950/95 border-amber-500 text-amber-300 animate-pulse'
              : 'bg-slate-900/95 border-emerald-500/60 text-emerald-400'
          }`}
          title="Open Tactical Walkie-Talkie Radio"
        >
          <div className="relative">
            <Radio className="w-4 h-4" />
            <span
              className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                activeRadioSpeaker ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
              }`}
            />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-mono text-[10px] font-black uppercase tracking-wider">
              {activeRadioSpeaker ? `VOICE: ${activeRadioSpeaker.name}` : 'SQUAD RADIO'}
            </span>
            <span className="font-mono text-[9px] text-slate-400">
              {isDirect ? `DIRECT: ${selectedTargetPlayer?.name || 'OPERATIVE'}` : 'SQUAD NET (ALL)'}
            </span>
          </div>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 ml-1" />
        </button>
      ) : (
        /* Expanded Tactical Walkie-Talkie Panel */
        <div className="bg-slate-950/95 border-2 border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-3 w-72 sm:w-80 flex flex-col gap-2.5 text-xs animate-in fade-in zoom-in-95 duration-200">
          {/* Radio Header & Minimizer */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-emerald-950 border border-emerald-600 text-emerald-400">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div>
                <div className="font-mono font-black text-xs text-white tracking-wider flex items-center gap-1.5">
                  <span>HIDER COMM-LINK</span>
                  <span className="text-[9px] font-mono text-emerald-400 px-1 py-0.2 rounded bg-emerald-950/80 border border-emerald-800">
                    SECURE
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  Seekers cannot hear this frequency
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

          {/* Active Incoming Audio Alert Banner */}
          {activeRadioSpeaker && (
            <div className="p-2 rounded-xl bg-amber-950/90 border border-amber-500/80 text-amber-200 flex items-center justify-between shadow-lg animate-pulse">
              <div className="flex items-center gap-2 min-w-0">
                <Volume2 className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                <div className="min-w-0">
                  <div className="font-mono font-black text-[11px] uppercase truncate">
                    {activeRadioSpeaker.name} TRANSMITTING
                  </div>
                  <div className="text-[10px] font-mono text-amber-300/80 truncate">
                    {activeRadioSpeaker.isDirect ? 'Direct Line (Private)' : 'Squad Net (All Hiders)'}
                  </div>
                </div>
              </div>

              {/* Animated Sound Wave Equalizer */}
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
                {fellowHiders.length} OPERATIVES ONLINE
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

            {/* If Direct is selected, show dropdown list of active hiders */}
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
          {!hasMicAccess && micPermission !== 'granted' ? (
            <button
              onClick={requestMicAccess}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg active:scale-95"
            >
              <Mic className="w-4 h-4" />
              <span>ENABLE MICROPHONE ACCESS</span>
            </button>
          ) : (
            /* Tactical PUSH TO TALK Button */
            <div className="space-y-1.5 pt-1">
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  startRecording();
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  stopRecording();
                }}
                onPointerLeave={() => {
                  if (isRecording) stopRecording();
                }}
                onPointerCancel={() => {
                  if (isRecording) stopRecording();
                }}
                className={`w-full py-4 rounded-xl border-2 font-mono font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all select-none touch-none shadow-2xl ${
                  isRecording
                    ? 'bg-red-600 border-white text-white shadow-red-950/80 scale-[0.98] ring-4 ring-red-500/50'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-emerald-400 text-slate-950'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    isRecording ? 'bg-white text-red-600 animate-ping' : 'bg-slate-950 text-emerald-400'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                </div>

                <div className="flex flex-col items-start leading-tight">
                  <span className="text-xs sm:text-sm">
                    {isRecording ? 'TRANSMITTING LIVE OPUS...' : 'HOLD TO TALK (PTT)'}
                  </span>
                  <span
                    className={`text-[9px] font-mono ${
                      isRecording ? 'text-red-200' : 'text-slate-900/80 font-bold'
                    }`}
                  >
                    {isRecording
                      ? `RELEASE TO SEND [00:0${recordingSeconds}]`
                      : isDirect
                      ? `PRIVATE TO ${selectedTargetPlayer?.name || 'OPERATIVE'}`
                      : 'BROADCAST TO SQUAD NET'}
                  </span>
                </div>
              </button>

              <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 px-1">
                <span>Hold button while speaking</span>
                <span>Opus Voice Burst</span>
              </div>
            </div>
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
