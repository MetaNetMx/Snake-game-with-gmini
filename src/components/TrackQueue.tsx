import { useState } from 'react';
import { Disc3, Pause, Play, Trash2 } from 'lucide-react';
import { formatDuration, type DemoTrack } from '../data/tracks';
import { SPEED_CONFIG, type SessionRun } from '../game/snakeTypes';

interface TrackQueueProps {
  tracks: DemoTrack[];
  activeTrackIndex: number;
  isPlaying: boolean;
  onSelectTrack: (index: number) => void;
  runs: SessionRun[];
  onClearRuns: () => void;
}

function TrackThumb({ track }: { track: DemoTrack }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10"
        style={{
          background: `radial-gradient(circle, ${track.accentGlowRgba}, #080B12)`,
        }}
      >
        <Disc3 className="h-5 w-5 text-slate-200" />
      </div>
    );
  }

  return (
    <img
      src={track.coverUrl}
      alt={`${track.title} cover`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-11 w-11 shrink-0 rounded-lg object-cover border border-white/10"
    />
  );
}

export function TrackQueue({
  tracks,
  activeTrackIndex,
  isPlaying,
  onSelectTrack,
  runs,
  onClearRuns,
}: TrackQueueProps) {
  const topRuns = [...runs].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <aside
      id="track-queue"
      aria-label="Demo Playlist and Score History"
      className="flex flex-col rounded-2xl bg-[#0D111C] border border-white/[0.08] p-5"
    >
      {/* Playlist Header */}
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-200 tracking-wide">AI Demo Tracks</h2>
        <span className="text-xs font-mono tabular-nums text-slate-400">
          {tracks.length} tracks
        </span>
      </div>

      {/* 3 Selectable Demo Tracks */}
      <div className="flex flex-col divide-y divide-white/[0.06] mb-6">
        {tracks.map((track, idx) => {
          const isActive = idx === activeTrackIndex;
          return (
            <button
              key={track.id}
              type="button"
              onClick={() => onSelectTrack(idx)}
              aria-current={isActive ? 'true' : undefined}
              className={`group flex w-full items-center gap-3 py-3 text-left transition-colors rounded-lg px-2 -mx-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-400 ${
                isActive ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'
              }`}
            >
              <div className="relative shrink-0">
                <TrackThumb track={track} />
                <div
                  className={`absolute inset-0 flex items-center justify-center rounded-lg bg-black/55 transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {isActive && isPlaying ? (
                    <Pause className="h-4 w-4 text-white fill-current" />
                  ) : (
                    <Play className="h-4 w-4 text-white fill-current translate-x-0.5" />
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="truncate text-sm font-medium"
                    style={isActive ? { color: track.accentHex } : { color: '#F1F5F9' }}
                  >
                    {track.title}
                  </span>
                  <span className="shrink-0 text-xs font-mono tabular-nums text-slate-400">
                    {formatDuration(track.durationSec)}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-400">
                  {track.artist} · {track.genre}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Session High Scores / Recent Runs */}
      <div id="score-board" className="pt-5 border-t border-white/[0.07] flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-200 tracking-wide">Top Runs</h2>
          {runs.length > 0 && (
            <button
              type="button"
              onClick={onClearRuns}
              aria-label="Clear saved runs"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 rounded"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        {topRuns.length === 0 ? (
          <div className="py-5 text-sm text-slate-400 leading-relaxed">
            Finish a round of Snake to log your best scores here.
          </div>
        ) : (
          <ol className="flex flex-col divide-y divide-white/[0.06]">
            {topRuns.map((run, index) => (
              <li key={run.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono tabular-nums text-slate-500 w-4">
                      {index + 1}.
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-slate-100">
                      {run.score} pts
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="text-xs text-slate-400">
                      {SPEED_CONFIG[run.speed].label}
                    </span>
                  </div>
                  <div className="pl-6 mt-0.5 text-xs text-slate-500 truncate">
                    {run.apples} orbs · {run.trackTitle}
                  </div>
                </div>
                <span className="shrink-0 text-xs font-mono tabular-nums text-slate-500">
                  {run.timestamp}
                </span>
              </li>
            ))}
          </ol>
        )}

        {/* Concise Keyboard Guide */}
        <div className="mt-auto pt-5 border-t border-white/[0.07]">
          <h3 className="text-xs font-medium text-slate-400 mb-2">Shortcuts</h3>
          <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
            <dt className="text-slate-400">Steer</dt>
            <dd className="text-right font-mono text-slate-200">Arrows / WASD</dd>
            <dt className="text-slate-400">Pause game</dt>
            <dd className="text-right font-mono text-slate-200">Space</dd>
            <dt className="text-slate-400">Reset board</dt>
            <dd className="text-right font-mono text-slate-200">R</dd>
            <dt className="text-slate-400">Next / Prev track</dt>
            <dd className="text-right font-mono text-slate-200">] / [</dd>
          </dl>
        </div>
      </div>
    </aside>
  );
}
