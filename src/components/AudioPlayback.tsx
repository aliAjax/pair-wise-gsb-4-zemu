import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { loadAudio } from '../state/storage';

/** 回放 IndexedDB 中的录音；无音频（模拟练习）时禁用 */
export function AudioPlayback({ audioId, size = 28 }: { audioId?: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let revoked = false;
    let created = '';
    if (audioId) {
      loadAudio(audioId).then(blob => {
        if (!blob || revoked) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      });
    }
    return () => {
      revoked = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [audioId]);

  if (!audioId || !url) {
    return (
      <button className="round-btn muted" disabled title="模拟练习未保存真实录音">
        <Play size={15} />
      </button>
    );
  }

  const toggle = () => {
    const el = document.getElementById(`audio-${audioId}`) as HTMLAudioElement | null;
    if (!el) return;
    if (playing) el.pause();
    else void el.play();
  };

  return (
    <>
      <button className="round-btn" onClick={toggle} style={{ width: size, height: size }}>
        {playing ? <Pause size={size * 0.5} /> : <Play size={size * 0.5} />}
      </button>
      <audio
        id={`audio-${audioId}`}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </>
  );
}
