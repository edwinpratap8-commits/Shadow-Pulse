import { useState, useRef, useCallback, useEffect } from 'react';
import { soundManager } from '../utils/audioEffects';

interface UseWalkieTalkieRecorderProps {
  onTransmit: (base64Audio: string, durationMs: number) => Promise<boolean>;
}

export function useWalkieTalkieRecorder({ onTransmit }: UseWalkieTalkieRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [hasMicAccess, setHasMicAccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check microphone permissions
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((status) => {
          setMicPermission(status.state as 'prompt' | 'granted' | 'denied');
          if (status.state === 'granted') {
            setHasMicAccess(true);
          }
          status.onchange = () => {
            setMicPermission(status.state as 'prompt' | 'granted' | 'denied');
            if (status.state === 'granted') setHasMicAccess(true);
          };
        })
        .catch(() => {
          // Some browsers don't support query for microphone
        });
    }
  }, []);

  const requestMicAccess = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Microphone not supported on this browser.');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;
      setHasMicAccess(true);
      setMicPermission('granted');
      setErrorMessage(null);
      return true;
    } catch (err: any) {
      console.warn('Microphone permission request error:', err);
      setMicPermission('denied');
      setErrorMessage('Microphone access denied. Enable permissions in browser to transmit.');
      return false;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    setErrorMessage(null);

    // Ensure we have mic access
    if (!mediaStreamRef.current || !mediaStreamRef.current.active) {
      const ok = await requestMicAccess();
      if (!ok) return;
    }

    const stream = mediaStreamRef.current;
    if (!stream) return;

    audioChunksRef.current = [];
    startTimeRef.current = Date.now();
    setRecordingSeconds(0);

    // Audio effects: PTT Click chirp & haptic buzz
    soundManager.playRadioPttClick();
    soundManager.triggerVibration([60]);

    // Determine optimal mimeType (Opus prioritized)
    let mimeType = 'audio/webm;codecs=opus';
    if (typeof MediaRecorder !== 'undefined') {
      if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else {
          mimeType = '';
        }
      }
    }

    try {
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 24000 })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(100); // chunk every 100ms
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start MediaRecorder:', err);
      setErrorMessage('Failed to start voice transmission.');
      setIsRecording(false);
    }
  }, [isRecording, requestMicAccess]);

  const stopRecording = useCallback(async () => {
    if (!isRecording && !mediaRecorderRef.current) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setIsRecording(false);
    const durationMs = Date.now() - startTimeRef.current;

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        // Minimum burst threshold: at least 350ms to ignore accidental micro-clicks
        if (durationMs < 350) {
          audioChunksRef.current = [];
          resolve();
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        audioChunksRef.current = [];

        // Convert blob to Base64 data URL
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Data = reader.result as string;
          // Radio squelch static drop effect on release
          soundManager.playRadioTransmissionEnd();
          soundManager.triggerVibration([40, 30, 40]);

          if (base64Data) {
            await onTransmit(base64Data, durationMs);
          }
          resolve();
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.stop();
    });
  }, [isRecording, onTransmit]);

  const cancelRecording = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
    }
  }, []);

  return {
    isRecording,
    recordingSeconds,
    hasMicAccess,
    micPermission,
    errorMessage,
    requestMicAccess,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
