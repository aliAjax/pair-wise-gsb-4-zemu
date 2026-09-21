// 浏览器录音：MediaRecorder（浏览器自带，无新依赖）。
// 不支持 / 拒绝麦克风时返回 null 音频，页面进入「模拟练习」模式，仍可走完整调度流程。

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveAudio } from '../state/storage';
import { uid } from '../domain/util';

export interface RecordingResult {
  audioId: string | null;
  durationSec: number;
  simulated: boolean;
}

export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [unsupported, setUnsupported] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const resolveRef = useRef<((r: RecordingResult) => void) | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    window.clearInterval(timerRef.current);
  }, []);

  useEffect(() => stopStream, [stopStream]);

  const start = useCallback(async () => {
    if (recording) return false;
    setSeconds(0);
    const mr = window.MediaRecorder;
    if (!mr || !navigator.mediaDevices?.getUserMedia) {
      setUnsupported(true);
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      mediaRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        let audioId: string | null = null;
        if (blob.size > 0) {
          audioId = uid('aud');
          await saveAudio(audioId, blob);
        }
        stopStream();
        resolveRef.current?.({ audioId, durationSec, simulated: false });
        resolveRef.current = null;
      };
      startedAtRef.current = Date.now();
      rec.start();
      setRecording(true);
      timerRef.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
      return true;
    } catch {
      setUnsupported(true);
      stopStream();
      return false;
    }
  }, [recording, stopStream]);

  const stop = useCallback((): Promise<RecordingResult> => {
    return new Promise(resolve => {
      const rec = mediaRef.current;
      if (rec && rec.state !== 'inactive') {
        resolveRef.current = resolve;
        rec.stop();
        setRecording(false);
      } else {
        resolve({ audioId: null, durationSec: 0, simulated: true });
      }
    });
  }, []);

  /** 无麦克风时的模拟计时练习 */
  const startSimulated = useCallback(() => {
    setUnsupported(false);
    setSeconds(0);
    startedAtRef.current = Date.now();
    setRecording(true);
    timerRef.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
  }, []);

  const stopSimulated = useCallback((): RecordingResult => {
    const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    window.clearInterval(timerRef.current);
    setRecording(false);
    return { audioId: null, durationSec, simulated: true };
  }, []);

  return { recording, seconds, unsupported, start, stop, startSimulated, stopSimulated };
}
