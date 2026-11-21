/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { DEMO_TRACKS } from './data/tracks';
import { synthEngine, type PlaybackSnapshot } from './audio/synthEngine';
import { MusicDeck } from './components/MusicDeck';
import { SnakeArena } from './components/SnakeArena';
import { TrackQueue } from './components/TrackQueue';
import type { SessionRun } from './game/snakeTypes';

const BEST_SCORE_KEY = 'neon_coil_best_score';
const RUNS_STORAGE_KEY = 'neon_coil_recent_runs';

function loadBestScore(): number {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function loadRuns(): SessionRun[] {
  try {
    const raw = window.localStorage.getItem(RUNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [playback, setPlayback] = useState<PlaybackSnapshot>(() => synthEngine.getSnapshot());
  const [bestScore, setBestScore] = useState<number>(() => loadBestScore());
  const [runs, setRuns] = useState<SessionRun[]>(() => loadRuns());
  const [restartSignal, setRestartSignal] = useState(0);

  const activeTrack = DEMO_TRACKS[playback.trackIndex] ?? DEMO_TRACKS[0];

  useEffect(() => {
    return synthEngine.subscribe(setPlayback);
  }, []);

  // Global keyboard shortcuts for music skipping & mute without conflicting with Snake keys
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === ']') {
        e.preventDefault();
        synthEngine.nextTrack(true);
      } else if (e.key === '[') {
        e.preventDefault();
        synthEngine.prevTrack(true);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        synthEngine.toggleMute();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSelectTrack = useCallback((index: number) => {
    const snap = synthEngine.getSnapshot();
    if (snap.trackIndex === index) {
      synthEngine.togglePlay();
    } else {
      synthEngine.selectTrack(index, true);
    }
  }, []);

  const handleStartMusicIfIdle = useCallback(() => {
    if (!synthEngine.getSnapshot().isPlaying) {
      synthEngine.play();
    }
  }, []);

  const handleRecordRun = useCallback((run: SessionRun) => {
    setBestScore((prev) => {
      const next = Math.max(prev, run.score);
      try {
        window.localStorage.setItem(BEST_SCORE_KEY, String(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });

    setRuns((prev) => {
      const next = [run, ...prev].slice(0, 12);
      try {
        window.localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  }, []);

  const handleClearRuns = useCallback(() => {
    setRuns([]);
    try {
      window.localStorage.removeItem(RUNS_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  return (
    <div className="relative min-h-screen bg-[#07090F] text-[#F1F5F9] flex flex-col overflow-x-clip">
      {/* Subtle Ambient Track-Synced Glow Field */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 transition-opacity duration-500"
        style={{
          background: `radial-gradient(640px circle at 50% 24%, ${activeTrack.accentHex}14, transparent 70%)`,
        }}
      />

      {/* Top Bar: Strict 3-Zone Contract */}
      <header className="relative z-10 border-b border-white/[0.07] bg-[#07090F]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-8 px-6 py-4">
          <a
            href="#snake-arena"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('snake-arena');
            }}
            className="text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Neon Coil
          </a>

          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400"
          >
            <button
              type="button"
              onClick={() => scrollToSection('snake-arena')}
              className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Snake Arena
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('music-deck')}
              className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Music Deck
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('track-queue')}
              className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              AI Tracks
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('score-board')}
              className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Top Runs
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => {
                scrollToSection('snake-arena');
                setRestartSignal((n) => n + 1);
              }}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-950 transition-transform duration-150 hover:brightness-110 active:scale-95 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={{
                backgroundColor: activeTrack.accentHex,
                boxShadow: `0 0 18px ${activeTrack.accentGlowRgba}`,
              }}
            >
              New Game
            </button>
          </div>
        </div>
      </header>

      {/* Main 3-Column Console: Music Deck (Left) | Snake Arena (Center) | AI Playlist & Scores (Right) */}
      <main className="relative z-10 mx-auto w-full max-w-[1380px] flex-1 px-4 sm:px-6 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_300px] xl:grid-cols-[320px_minmax(0,1fr)_320px] gap-6 items-start">
          {/* Left Column: Music Player Deck */}
          <div className="order-2 lg:order-1">
            <MusicDeck
              track={activeTrack}
              playback={playback}
              onPlayPause={() => synthEngine.togglePlay()}
              onPrev={() => synthEngine.prevTrack(true)}
              onNext={() => synthEngine.nextTrack(true)}
              onSeek={(sec) => synthEngine.seek(sec)}
              onVolumeChange={(v) => synthEngine.setVolume(v)}
              onToggleMute={() => synthEngine.toggleMute()}
              onToggleRepeat={() => synthEngine.toggleRepeatOne()}
              onToggleSfx={() => synthEngine.toggleSfx()}
            />
          </div>

          {/* Center Window: Dominant Snake Game */}
          <div className="order-1 lg:order-2">
            <SnakeArena
              track={activeTrack}
              isMusicPlaying={playback.isPlaying}
              onStartMusicIfIdle={handleStartMusicIfIdle}
              bestScore={bestScore}
              onRecordRun={handleRecordRun}
              restartSignal={restartSignal}
            />
          </div>

          {/* Right Column: 3 AI Demo Tracks & Score History */}
          <div className="order-3">
            <TrackQueue
              tracks={DEMO_TRACKS}
              activeTrackIndex={playback.trackIndex}
              isPlaying={playback.isPlaying}
              onSelectTrack={handleSelectTrack}
              runs={runs}
              onClearRuns={handleClearRuns}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
