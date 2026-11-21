import { useEffect, useRef, useState } from 'react';
import {
  Pause,
  Play,
  Repeat1,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Disc3,
  AudioWaveform,
} from 'lucide-react';
import { formatDuration, type DemoTrack } from '../data/tracks';
import { synthEngine, type PlaybackSnapshot } from '../audio/synthEngine';

interface MusicDeckProps {
  track: DemoTrack;
  playback: PlaybackSnapshot;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleRepeat: () => void;
  onToggleSfx: () => void;
}

export function MusicDeck({
  track,
  playback,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleRepeat,
  onToggleSfx,
}: MusicDeckProps) {
  const visualizerRef = useRef<HTMLCanvasElement | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [track.coverUrl]);

  // Real-time FFT spectrum visualizer
  useEffect(() => {
    const canvas = visualizerRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = 264;
    const height = 44;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const bins = new Uint8Array(64);
    const barCount = 28;
    const smoothed = new Float32Array(barCount);
    let rafId = 0;

    const render = () => {
      synthEngine.getFrequencyData(bins);
      ctx.clearRect(0, 0, width, height);

      const gap = 3;
      const barWidth = (width - gap * (barCount - 1)) / barCount;

      const grad = ctx.createLinearGradient(0, height, 0, 0);
      grad.addColorStop(0, track.accentSecondaryHex);
      grad.addColorStop(1, track.accentHex);

      for (let i = 0; i < barCount; i++) {
        const binIndex = Math.min(bins.length - 1, Math.floor(i * 1.4) + 1);
        const raw = playback.isPlaying ? bins[binIndex] / 255 : 0;
        const target = playback.isPlaying ? Math.max(0.08, raw) : 0.06;
        smoothed[i] += (target - smoothed[i]) * 0.24;

        const barH = Math.max(3, smoothed[i] * (height - 4));
        const x = i * (barWidth + gap);
        const y = height - barH;

        ctx.fillStyle = playback.isPlaying ? grad : 'rgba(148, 163, 184, 0.22)';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [playback.isPlaying, track.accentHex, track.accentSecondaryHex]);

  const progressPct =
    playback.duration > 0 ? Math.min(100, (playback.currentTime / playback.duration) * 100) : 0;
  const effectiveVolume = playback.isMuted ? 0 : playback.volume;

  return (
    <section
      id="music-deck"
      aria-label="Music Player"
      className="flex flex-col rounded-2xl bg-[#0D111C] border border-white/[0.08] p-5"
      style={
        {
          '--track-accent': track.accentHex,
          '--track-glow': track.accentGlowRgba,
        } as React.CSSProperties
      }
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-200 tracking-wide">Now Playing</h2>
        <span className="text-xs font-mono tabular-nums text-slate-400">
          {playback.isPlaying ? 'Playing' : 'Paused'}
        </span>
      </div>

      {/* Album Art */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#080B12] mb-4">
        {!imgFailed ? (
          <img
            src={track.coverUrl}
            alt={`${track.title} album cover`}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300"
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center"
            style={{
              background: `radial-gradient(circle at 30% 20%, ${track.accentGlowRgba}, #080B12 75%)`,
            }}
          >
            <Disc3 className="h-12 w-12 text-slate-200/80" />
            <span className="text-sm font-medium text-slate-200">{track.title}</span>
          </div>
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            boxShadow: playback.isPlaying
              ? `inset 0 0 28px ${track.accentGlowRgba}`
              : 'inset 0 0 18px rgba(0,0,0,0.45)',
          }}
        />
      </div>

      {/* Track Title & Unboxed Metadata */}
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-slate-50 leading-tight truncate">
          {track.title}
        </h3>
        <p className="text-sm text-slate-300 mt-0.5 truncate">{track.artist}</p>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
          <span>{track.genre}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{track.bpm} BPM</span>
        </div>
      </div>

      {/* Live Spectrum Visualizer */}
      <div className="mb-3 overflow-hidden rounded-lg bg-[#080B12] border border-white/[0.06] px-2.5 py-2">
        <canvas
          ref={visualizerRef}
          className="block h-[44px] w-full"
          aria-label="Audio frequency spectrum"
        />
      </div>

      {/* Scrubber & Timestamps */}
      <div className="mb-4">
        <input
          type="range"
          min={0}
          max={playback.duration}
          step={0.5}
          value={Math.min(playback.duration, playback.currentTime)}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Seek track position"
          className="neon-range w-full"
          style={{
            background: `linear-gradient(to right, ${track.accentHex} 0%, ${track.accentHex} ${progressPct}%, rgba(148,163,184,0.2) ${progressPct}%, rgba(148,163,184,0.2) 100%)`,
            borderRadius: '9999px',
            height: '4px',
          }}
        />
        <div className="mt-1.5 flex items-center justify-between text-xs font-mono tabular-nums text-slate-400">
          <span>{formatDuration(playback.currentTime)}</span>
          <span>{formatDuration(playback.duration)}</span>
        </div>
      </div>

      {/* Transport Controls */}
      <div className="flex items-center justify-between gap-2 pb-4 border-b border-white/[0.07]">
        <button
          type="button"
          onClick={onToggleRepeat}
          aria-label={playback.isRepeatOne ? 'Disable repeat track' : 'Repeat current track'}
          aria-pressed={playback.isRepeatOne}
          title={playback.isRepeatOne ? 'Repeat track on' : 'Repeat track off'}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          style={playback.isRepeatOne ? { color: track.accentHex } : undefined}
        >
          <Repeat1 className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous track"
            title="Previous track"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-200 hover:bg-white/[0.08] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            <SkipBack className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={onPlayPause}
            aria-label={playback.isPlaying ? 'Pause music' : 'Play music'}
            className="flex h-12 w-12 items-center justify-center rounded-full text-slate-950 font-semibold transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            style={{
              backgroundColor: track.accentHex,
              boxShadow: `0 0 22px ${track.accentGlowRgba}`,
            }}
          >
            {playback.isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current translate-x-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            aria-label="Next track"
            title="Next track"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-200 hover:bg-white/[0.08] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleSfx}
          aria-label={playback.sfxEnabled ? 'Mute game sound effects' : 'Enable game sound effects'}
          aria-pressed={playback.sfxEnabled}
          title={playback.sfxEnabled ? 'Game SFX on' : 'Game SFX muted'}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          style={playback.sfxEnabled ? { color: track.accentHex } : undefined}
        >
          <AudioWaveform className="h-4 w-4" />
        </button>
      </div>

      {/* Volume & SFX status row */}
      <div className="pt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={playback.isMuted ? 'Unmute audio' : 'Mute audio'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        >
          {playback.isMuted || playback.volume === 0 ? (
            <VolumeX className="h-4 w-4 text-slate-400" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={effectiveVolume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          aria-label="Master volume"
          className="neon-range flex-1"
          style={{
            background: `linear-gradient(to right, ${track.accentHex} 0%, ${track.accentHex} ${
              effectiveVolume * 100
            }%, rgba(148,163,184,0.2) ${effectiveVolume * 100}%, rgba(148,163,184,0.2) 100%)`,
            borderRadius: '9999px',
            height: '4px',
          }}
        />

        <span className="w-9 text-right text-xs font-mono tabular-nums text-slate-400">
          {Math.round(effectiveVolume * 100)}%
        </span>
      </div>
    </section>
  );
}
