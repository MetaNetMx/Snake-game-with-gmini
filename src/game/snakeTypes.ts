export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type SpeedPreset = 'chill' | 'classic' | 'turbo';

export type WallMode = 'solid' | 'wrap';

export interface GridPoint {
  x: number;
  y: number;
}

export interface BonusOrb {
  pos: GridPoint;
  expiresAt: number;
  durationMs: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface SessionRun {
  id: string;
  score: number;
  apples: number;
  speed: SpeedPreset;
  wallMode: WallMode;
  trackTitle: string;
  timestamp: string;
}

export const GRID_SIZE = 20;

export const SPEED_CONFIG: Record<
  SpeedPreset,
  { label: string; baseTickMs: number; minTickMs: number; stepAccelMs: number }
> = {
  chill: {
    label: 'Chill',
    baseTickMs: 145,
    minTickMs: 92,
    stepAccelMs: 1.5,
  },
  classic: {
    label: 'Classic',
    baseTickMs: 112,
    minTickMs: 68,
    stepAccelMs: 2.0,
  },
  turbo: {
    label: 'Turbo',
    baseTickMs: 82,
    minTickMs: 52,
    stepAccelMs: 1.8,
  },
};
