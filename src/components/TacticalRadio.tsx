import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { soundManager } from '../utils/audioEffects';
import {
  Radio,
  Mic,
  Square,
  Send,
  Volume2,
  Users,
  User,
  ChevronUp,
  ChevronDown,
  Lock,
  Headphones,
  AlertTriangle,
  Play,
  MessageSquare,
} from 'lucide-react';

const QUICK_CALLOUTS = [
  'SEEKER NEAR ME!',
  'MOVING SECTOR',
  'HOLD POSITION',
  'ALL CLEAR',
];

function getSupportedRecordingMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    } catch {}
  }
  return '';
}

export const TacticalRadio: React.FC = () => {
  const {
    currentUser,
    players,
    gameState,
    radioTarget,
    setRadioTarget,
    activeRadioSpeaker,
    radioHistory,
    playingTransmissionId,
    audioUnlocked,
    unlockAudio,
    transmitVoiceBurst,
    transmitTextAlert,
    replayTransmission,
  } = useGame();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [customText, setCustomText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordStartTimeRef = useRef<number>(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const cancelledRef = useRef<boolean>(false);

  // Active fellow hiders (excluding current user)
  const fellowHiders = players.filter(
    (p) => p.role === 'HIDER' && p.status === 'ACTIVE' && p.id !== currentUser?.id
  );

  // Cleanup recorder & stream on unmount or role change
  const cleanupRecordingResources = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setMicLevel(0);
  };

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      cleanupRecordingResources();
    };
  }, []);

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

  const showTempStatus = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => {
      setStatusNotice((curr) => (curr === msg ? null : curr));
    }, 2200);
  };

  const startRecording = async () => {
    unlockAudio();
    setErrorMessage(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMessage('Voice recording is not supported on this browser. Use Quick-Comms below.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      cancelledRef.current = false;
      recordStartTimeRef.current = Date.now();
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const elapsedMs = Date.now() - recordStartTimeRef.current;
        const recordedMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: recordedMime });
        cleanupRecordingResources();
        setIsRecording(false);
        setRecordingSeconds(0);

        if (cancelledRef.current) {
          return;
        }

        if (elapsedMs < 350 || blob.size < 250) {
          setErrorMessage('Recording too short. Tap Record, speak for 1-10s, then tap Send.');
          return;
        }

        setIsSending(true);
        try {
          const base64DataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string') resolve(reader.result);
              else reject(new Error('Failed to encode audio'));
            };
            reader.onerror = () => reject(new Error('Failed to read recorded audio'));
            reader.readAsDataURL(blob);
          });

          const ok = await transmitVoiceBurst(base64DataUrl, elapsedMs);
          if (ok) {
            soundManager.playRadioTransmissionEnd();
            showTempStatus(isDirect ? `Sent voice to ${selectedTargetPlayer?.name || 'Operative'}` : 'Voice burst sent to Squad');
          } else {
            setErrorMessage('Failed to relay voice burst. Check network or target status.');
          }
        } catch {
          setErrorMessage('Could not encode audio clip.');
        } finally {
          setIsSending(false);
        }
      };

      // Live mic level meter
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          src.connect(analyser);
          analyserRef.current = analyser;
          const buf = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i];
            setMicLevel(Math.min(100, Math.round((sum / buf.length / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(tick);
          };
          tick();
        }
      } catch {}

      soundManager.playRadioPttClick();
      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordTimerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - recordStartTimeRef.current) / 1000);
        setRecordingSeconds(secs);
        // Auto-stop and send at 15s max clip length to keep relay instant
        if (secs >= 15 && mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 250);
    } catch (err: unknown) {
      cleanupRecordingResources();
      const msg = err instanceof Error ? err.message : 'Microphone permission denied.';
      setErrorMessage(`Mic unavailable (${msg}). Use Quick-Comms below.`);
    }
  };

  const stopAndSendRecording = () => {
    cancelledRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    cancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupRecordingResources();
      setIsRecording(false);
    }
  };

  const handleSendQuickText = async (text: string) => {
    const clean = text.trim();
    if (!clean || isSending) return;
    unlockAudio();
    setErrorMessage(null);
    setIsSending(true);
    const ok = await transmitTextAlert(clean);
    setIsSending(false);
    if (ok) {
      soundManager.playRadioPttClick();
      setCustomText('');
      showTempStatus('Tactical alert sent');
    } else {
      setErrorMessage('Could not deliver tactical alert.');
    }
  };

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
            activeRadioSpeaker
              ? 'bg-amber-950/95 border-amber-500 text-amber-300 animate-pulse'
              : isRecording
              ? 'bg-red-950/95 border-red-500 text-red-300 ring-2 ring-red-500/50'
              : 'bg-slate-900/95 border-emerald-500/60 text-emerald-400'
          }`}
          title="Open Hider Walkie-Talkie & Comms"
        >
          <div className="relative">
            <Radio className="w-4 h-4" />
            <span
              className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                activeRadioSpeaker
                  ? 'bg-amber-400 animate-ping'
                  : isRecording
                  ? 'bg-red-400 animate-ping'
                  : 'bg-emerald-400'
              }`}
            />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-mono text-[10px] font-black uppercase tracking-wider">
              {activeRadioSpeaker
                ? `INCOMING: ${activeRadioSpeaker.name}`
                : isRecording
                ? `RECORDING ${recordingSeconds}s`
                : 'SQUAD WALKIE-TALKIE'}
            </span>
            <span className="font-mono text-[9px] text-slate-400">
              {isDirect ? `DIRECT: ${selectedTargetPlayer?.name || 'OPERATIVE'}` : `SQUAD NET (${fellowHiders.length} ONLINE)`}
            </span>
          </div>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 ml-1" />
        </button>
      ) : (
        /* Expanded Server-Relayed Walkie-Talkie & Tactical Comms Panel */
        <div className="bg-slate-950/95 border-2 border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-3 w-76 sm:w-84 flex flex-col gap-2.5 text-xs">
          {/* Header & Minimizer */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-emerald-950 border border-emerald-600 text-emerald-400">
                <Radio className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-mono font-black text-xs text-white tracking-wider flex items-center gap-1.5">
                  <span>HIDER WALKIE-TALKIE</span>
                  <span className="text-[9px] font-mono text-emerald-400 px-1 py-0.2 rounded bg-emerald-950/80 border border-emerald-800">
                    RELAYED
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  Encrypted voice bursts & alerts. Seekers blocked.
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsExpanded(false)}
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
              title="Minimize Radio"
              aria-label="Minimize walkie-talkie"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Active Incoming Alert */}
          {activeRadioSpeaker && (
            <div className="p-2 rounded-xl bg-amber-950/90 border border-amber-500/80 text-amber-200 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2 min-w-0">
                <Volume2 className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                <div className="min-w-0">
                  <div className="font-mono font-black text-[11px] uppercase truncate">
                    {activeRadioSpeaker.name} TRANSMITTING
                  </div>
                  <div className="text-[10px] font-mono text-amber-300/80 truncate">
                    {activeRadioSpeaker.isDirect ? 'Direct 1-to-1 Line' : 'Squad Net (All Hiders)'}
                  </div>
                </div>
              </div>
              <div className="flex items-end gap-0.5 h-4 shrink-0 pl-1">
                <span className="w-1 bg-amber-400 h-3 animate-pulse" />
                <span className="w-1 bg-amber-300 h-4 animate-bounce" />
                <span className="w-1 bg-amber-400 h-2 animate-pulse" />
              </div>
            </div>
          )}

          {/* Frequency Selector */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono font-bold uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>CHANNEL:</span>
              <span className="text-emerald-400 font-semibold">
                {fellowHiders.length} HIDERS ONLINE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
              <button
                onClick={() => {
                  unlockAudio();
                  setRadioTarget({ type: 'GROUP' });
                }}
                className={`py-1.5 px-2 rounded-lg border font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  !isDirect
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>SQUAD (ALL)</span>
              </button>

              <button
                onClick={() => {
                  unlockAudio();
                  if (fellowHiders.length > 0) {
                    setRadioTarget({
                      type: 'DIRECT',
                      targetPlayerId: fellowHiders[0].id,
                      targetPlayerName: fellowHiders[0].name,
                    });
                  }
                }}
                disabled={fellowHiders.length === 0}
                className={`py-1.5 px-2 rounded-lg border font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer ${
                  isDirect
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>1-TO-1 DIRECT</span>
              </button>
            </div>

            {isDirect && fellowHiders.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 pt-0.5">
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
                      className={`px-2 py-1 rounded border font-mono text-[10px] font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-600 border-cyan-300 text-slate-950'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <User className="w-2.5 h-2.5" />
                      <span>{hider.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Walkie-Talkie Voice Burst Recorder */}
          <div className="space-y-1.5">
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={isSending}
                className="w-full py-3 rounded-xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-mono font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg disabled:opacity-60 cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>
                  {isSending
                    ? 'SENDING VOICE BURST...'
                    : isDirect
                    ? `RECORD VOICE TO ${selectedTargetPlayer?.name || 'OPERATIVE'}`
                    : 'TAP TO RECORD VOICE BURST'}
                </span>
              </button>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={stopAndSendRecording}
                    className="flex-1 py-3 rounded-xl border-2 border-white bg-red-600 hover:bg-red-500 text-white font-mono font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg animate-pulse cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>STOP &amp; SEND ({recordingSeconds}s / 15s)</span>
                  </button>
                  <button
                    onClick={cancelRecording}
                    className="px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono font-bold text-[10px] uppercase cursor-pointer"
                  >
                    CANCEL
                  </button>
                </div>

                {/* Live Mic Level Bar */}
                <div className="flex items-center gap-2 px-2 py-1 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[9px] font-mono text-red-400 font-bold">MIC</span>
                  <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-red-400 transition-all duration-75"
                      style={{ width: `${Math.max(8, micLevel)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Instant Tactical Quick-Comms */}
          <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
            <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-emerald-400" />
              <span>INSTANT TACTICAL ALERTS (SILENT):</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {QUICK_CALLOUTS.map((callout) => (
                <button
                  key={callout}
                  onClick={() => handleSendQuickText(callout)}
                  disabled={isSending}
                  className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-mono font-bold text-[9px] uppercase tracking-wide transition-colors truncate cursor-pointer disabled:opacity-50"
                >
                  {callout}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendQuickText(customText);
              }}
              className="flex gap-1.5 pt-0.5"
            >
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Whisper short message..."
                maxLength={80}
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={!customText.trim() || isSending}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono font-bold flex items-center justify-center disabled:opacity-40 cursor-pointer"
                aria-label="Send radio text alert"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Recent Transmissions Feed (with Replay button) */}
          {radioHistory.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-slate-800/80 max-h-28 overflow-y-auto">
              <div className="text-[9px] font-mono uppercase text-slate-500 tracking-wider">
                RECENT COMMS LOG:
              </div>
              {radioHistory.slice(0, 4).map((t) => {
                const isMine = t.senderId === currentUser.id;
                const isPlaying = playingTransmissionId === t.id;
                return (
                  <div
                    key={t.id}
                    className={`px-2 py-1.5 rounded-lg border text-[10px] font-mono flex items-center justify-between gap-2 ${
                      isPlaying
                        ? 'bg-amber-950/70 border-amber-500 text-amber-200'
                        : 'bg-slate-900/90 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="min-w-0 truncate">
                      <span className={`font-bold ${isMine ? 'text-emerald-400' : 'text-cyan-300'}`}>
                        {isMine ? 'YOU' : t.senderName}
                      </span>
                      {t.targetType === 'DIRECT' && (
                        <span className="text-[9px] text-cyan-400 ml-1">[1:1]</span>
                      )}
                      <span className="text-slate-400 ml-1.5">
                        {t.messageType === 'TEXT' || !t.audioData
                          ? t.textMessage
                          : `Voice (${Math.max(1, Math.round(t.durationMs / 1000))}s)`}
                      </span>
                    </div>

                    {t.audioData && (
                      <button
                        onClick={() => replayTransmission(t)}
                        className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-600 text-emerald-300 hover:bg-emerald-900 text-[9px] font-bold flex items-center gap-0.5 shrink-0 cursor-pointer"
                        title="Play voice burst"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>{isPlaying ? 'PLAYING' : 'PLAY'}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Speaker Unlock Hint */}
          {!audioUnlocked && (
            <button
              onClick={unlockAudio}
              className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-700/80 text-cyan-300 text-[10px] font-mono flex items-center justify-center gap-1.5 hover:bg-cyan-900/80 cursor-pointer"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Tap to unlock auto-play speaker audio</span>
            </button>
          )}

          {statusNotice && (
            <div className="px-2 py-1 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-[10px] font-mono text-center">
              ✓ {statusNotice}
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
