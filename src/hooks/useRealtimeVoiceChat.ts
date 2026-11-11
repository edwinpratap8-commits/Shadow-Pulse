import { useState, useEffect, useRef, useCallback } from 'react';
import { Player, RadioTargetType, WebRTCSignalPacket } from '../game/radarRules';

interface UseRealtimeVoiceChatProps {
  roomCode: string;
  currentUser: Player | null;
  players: Player[];
  targetType: RadioTargetType;
  targetPlayerId?: string;
  onIncomingSpeaker?: (speaker: { id: string; name: string; isDirect: boolean } | null) => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function useRealtimeVoiceChat({
  roomCode,
  currentUser,
  players,
  targetType,
  targetPlayerId,
  onIncomingSpeaker,
}: UseRealtimeVoiceChatProps) {
  const [hasMicAccess, setHasMicAccess] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [isOpenMic, setIsOpenMic] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 for visualizer
  const [activeSpeakerName, setActiveSpeakerName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Active fellow hiders
  const fellowHiders = players.filter(
    (p) => p.role === 'HIDER' && p.status === 'ACTIVE' && p.id !== currentUser?.id
  );

  // Send WebRTC signal to server
  const sendSignal = useCallback(
    async (toPlayerId: string | undefined, signal: WebRTCSignalPacket['signal']) => {
      if (!currentUser || !roomCode) return;
      try {
        await fetch(`/api/rooms/${roomCode}/webrtc/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromPlayerId: currentUser.id,
            fromPlayerName: currentUser.name,
            toPlayerId,
            targetType,
            signal,
          }),
        });
      } catch (err) {
        console.warn('Failed to send WebRTC signal:', err);
      }
    },
    [currentUser, roomCode, targetType]
  );

  // Unlock mobile audio playback
  const unlockAudio = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
        }
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      setAudioUnlocked(true);
    } catch (e) {
      console.warn('AudioContext unlock note:', e);
    }
  }, []);

  // Request mic access & setup audio analysis
  const requestMicAccess = useCallback(async () => {
    unlockAudio();
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Mute track initially until PTT is held or open mic is active
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });

      localStreamRef.current = stream;
      setHasMicAccess(true);
      setIsLiveConnected(true);

      // Setup audio analyzer for real-time visualizer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = audioContextRef.current || new AudioCtx();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLevel = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            }
            animFrameRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        }
      } catch (err) {
        console.warn('Audio analyzer init note:', err);
      }

      return true;
    } catch (err: any) {
      console.error('Microphone access denied:', err);
      setErrorMessage(err.message || 'Microphone access denied. Please grant permission in browser settings.');
      return false;
    }
  }, [unlockAudio]);

  // Create or retrieve PeerConnection for a specific peer
  const getOrCreatePeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      let pc = peerConnectionsRef.current.get(peerId);
      if (pc && pc.connectionState !== 'closed') {
        return pc;
      }

      pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionsRef.current.set(peerId, pc);

      // Add local audio tracks if stream exists
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          pc!.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(peerId, {
            type: 'candidate',
            candidate: event.candidate,
          });
        }
      };

      // Handle remote incoming live audio track
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        let audioEl = remoteAudiosRef.current.get(peerId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          remoteAudiosRef.current.set(peerId, audioEl);
        }
        audioEl.srcObject = remoteStream;
        audioEl.play().catch((e) => console.log('Autoplay handled:', e));
      };

      return pc;
    },
    [sendSignal]
  );

  // Initiate WebRTC call with peer (offer)
  const initiateCallWithPeer = useCallback(
    async (peerId: string) => {
      try {
        const pc = getOrCreatePeerConnection(peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal(peerId, {
          type: 'offer',
          sdp: pc.localDescription,
        });
      } catch (err) {
        console.warn('Create offer error with peer:', peerId, err);
      }
    },
    [getOrCreatePeerConnection, sendSignal]
  );

  // Incoming signal listener
  const handleIncomingSignal = useCallback(
    async (packet: WebRTCSignalPacket) => {
      if (!currentUser || packet.fromPlayerId === currentUser.id) return;

      const { fromPlayerId, fromPlayerName, signal } = packet;

      // Filter direct lines
      if (packet.targetType === 'DIRECT' && packet.toPlayerId !== currentUser.id) {
        return;
      }

      // 1. Mute / Speaking indicator updates
      if (signal.type === 'speaking') {
        if (signal.speaking) {
          setActiveSpeakerName(fromPlayerName);
          onIncomingSpeaker?.({
            id: fromPlayerId,
            name: fromPlayerName,
            isDirect: packet.targetType === 'DIRECT',
          });
        } else {
          setActiveSpeakerName(null);
          onIncomingSpeaker?.(null);
        }
        return;
      }

      // 2. WebRTC SDP Offer
      if (signal.type === 'offer' && signal.sdp) {
        try {
          const pc = getOrCreatePeerConnection(fromPlayerId);
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal(fromPlayerId, {
            type: 'answer',
            sdp: pc.localDescription,
          });
        } catch (err) {
          console.warn('Error handling SDP offer:', err);
        }
      }

      // 3. WebRTC SDP Answer
      if (signal.type === 'answer' && signal.sdp) {
        try {
          const pc = peerConnectionsRef.current.get(fromPlayerId);
          if (pc && pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          }
        } catch (err) {
          console.warn('Error handling SDP answer:', err);
        }
      }

      // 4. ICE Candidate
      if (signal.type === 'candidate' && signal.candidate) {
        try {
          const pc = peerConnectionsRef.current.get(fromPlayerId);
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
        } catch (err) {
          console.warn('Error adding ICE candidate:', err);
        }
      }
    },
    [currentUser, getOrCreatePeerConnection, onIncomingSpeaker, sendSignal]
  );

  // Connect to active fellow hiders once mic is granted
  useEffect(() => {
    if (!hasMicAccess || !currentUser || currentUser.role !== 'HIDER' || currentUser.status !== 'ACTIVE') {
      return;
    }

    fellowHiders.forEach((hider) => {
      // Connect deterministically if my ID is lexicographically greater
      if (currentUser.id > hider.id) {
        initiateCallWithPeer(hider.id);
      }
    });
  }, [hasMicAccess, fellowHiders.length, currentUser?.id, initiateCallWithPeer]);

  // Instant Push-to-Talk (Unmute live audio track with ZERO latency)
  const startTalking = useCallback(() => {
    unlockAudio();
    if (!localStreamRef.current) {
      requestMicAccess().then((granted) => {
        if (granted && localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = true));
          setIsTalking(true);
          sendSignal(targetPlayerId, { type: 'speaking', speaking: true });
        }
      });
      return;
    }

    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    setIsTalking(true);
    sendSignal(targetPlayerId, { type: 'speaking', speaking: true });
  }, [unlockAudio, requestMicAccess, sendSignal, targetPlayerId]);

  // Release PTT (Mute live track instantly)
  const stopTalking = useCallback(() => {
    if (isOpenMic) return; // In open mic mode, stays unmuted

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }
    setIsTalking(false);
    sendSignal(targetPlayerId, { type: 'speaking', speaking: false });
  }, [isOpenMic, sendSignal, targetPlayerId]);

  // Toggle Open-Mic Hands-Free mode
  const toggleOpenMic = useCallback(() => {
    unlockAudio();
    setIsOpenMic((prev) => {
      const next = !prev;
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = next));
      }
      setIsTalking(next);
      sendSignal(targetPlayerId, { type: 'speaking', speaking: next });
      return next;
    });
  }, [unlockAudio, sendSignal, targetPlayerId]);

  // Cleanup on unmount or when captured
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      remoteAudiosRef.current.forEach((a) => {
        a.pause();
        a.srcObject = null;
      });
      remoteAudiosRef.current.clear();
    };
  }, []);

  return {
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
  };
}
