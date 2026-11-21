import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import type { DemoTrack } from '../data/tracks';
import { synthEngine } from '../audio/synthEngine';
import {
  GRID_SIZE,
  SPEED_CONFIG,
  type BonusOrb,
  type Direction,
  type GameState,
  type GridPoint,
  type Particle,
  type SessionRun,
  type SpeedPreset,
  type WallMode,
} from '../game/snakeTypes';

interface SnakeArenaProps {
  track: DemoTrack;
  isMusicPlaying: boolean;
  onStartMusicIfIdle: () => void;
  bestScore: number;
  onRecordRun: (run: SessionRun) => void;
  restartSignal: number;
}

interface FloatingScore {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

function createInitialSnake(): GridPoint[] {
  const mid = Math.floor(GRID_SIZE / 2);
  return [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
    { x: mid - 3, y: mid },
  ];
}

function randomEmptyCell(occupied: GridPoint[]): GridPoint {
  const blocked = new Set(occupied.map((p) => `${p.x},${p.y}`));
  const candidates: GridPoint[] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (!blocked.has(`${x},${y}`)) {
        candidates.push({ x, y });
      }
    }
  }
  if (candidates.length === 0) return { x: 0, y: 0 };
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function SnakeArena({
  track,
  isMusicPlaying,
  onStartMusicIfIdle,
  bestScore,
  onRecordRun,
  restartSignal,
}: SnakeArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const arenaContainerRef = useRef<HTMLDivElement | null>(null);

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [score, setScore] = useState(0);
  const [apples, setApples] = useState(0);
  const [streak, setStreak] = useState(0);
  const [snakeLength, setSnakeLength] = useState(4);
  const [speedPreset, setSpeedPreset] = useState<SpeedPreset>('classic');
  const [wallMode, setWallMode] = useState<WallMode>('solid');
  const [isNewBest, setIsNewBest] = useState(false);

  // Mutable simulation refs for smooth 60fps canvas rendering without React re-render lag
  const snakeRef = useRef<GridPoint[]>(createInitialSnake());
  const prevSnakeRef = useRef<GridPoint[]>(createInitialSnake());
  const directionRef = useRef<Direction>('RIGHT');
  const inputQueueRef = useRef<Direction[]>([]);
  const foodRef = useRef<GridPoint>({ x: 14, y: 10 });
  const bonusRef = useRef<BonusOrb | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const floatersRef = useRef<FloatingScore[]>([]);
  const scoreRef = useRef(0);
  const applesRef = useRef(0);
  const streakRef = useRef(0);
  const lastEatTimeRef = useRef(0);
  const lastStepTimeRef = useRef(0);
  const crashFlashRef = useRef(0);
  const gameStateRef = useRef<GameState>('TITLE_MENU');
  const speedRef = useRef<SpeedPreset>('classic');
  const wallModeRef = useRef<WallMode>('solid');
  const trackRef = useRef<DemoTrack>(track);
  const bestScoreRef = useRef(bestScore);

  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  useEffect(() => {
    bestScoreRef.current = bestScore;
  }, [bestScore]);

  useEffect(() => {
    speedRef.current = speedPreset;
  }, [speedPreset]);

  useEffect(() => {
    wallModeRef.current = wallMode;
  }, [wallMode]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const spawnParticles = useCallback((gridPos: GridPoint, color: string, count = 14) => {
    const cx = gridPos.x + 0.5;
    const cy = gridPos.y + 0.5;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 1.6 + Math.random() * 3.4;
      particlesRef.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 0.35 + Math.random() * 0.25,
        color,
        size: 2.2 + Math.random() * 2.6,
      });
    }
  }, []);

  const startNewGame = useCallback(
    (autoStartAudio = true) => {
      const initial = createInitialSnake();
      snakeRef.current = initial;
      prevSnakeRef.current = initial.map((p) => ({ ...p }));
      directionRef.current = 'RIGHT';
      inputQueueRef.current = [];
      foodRef.current = randomEmptyCell(initial);
      bonusRef.current = null;
      particlesRef.current = [];
      floatersRef.current = [];
      scoreRef.current = 0;
      applesRef.current = 0;
      streakRef.current = 0;
      lastEatTimeRef.current = 0;
      crashFlashRef.current = 0;
      lastStepTimeRef.current = performance.now();

      setScore(0);
      setApples(0);
      setStreak(0);
      setSnakeLength(initial.length);
      setIsNewBest(false);
      setGameState('PLAYING');
      gameStateRef.current = 'PLAYING';

      synthEngine.playStartSfx();
      if (autoStartAudio && !isMusicPlaying) {
        onStartMusicIfIdle();
      }
    },
    [isMusicPlaying, onStartMusicIfIdle],
  );

  // Triggered when the user clicks "New Game" in the Top Bar
  const prevRestartSignal = useRef(restartSignal);
  useEffect(() => {
    if (restartSignal !== prevRestartSignal.current) {
      prevRestartSignal.current = restartSignal;
      startNewGame(true);
    }
  }, [restartSignal, startNewGame]);

  const togglePause = useCallback(() => {
    if (gameStateRef.current === 'PLAYING') {
      setGameState('PAUSED');
      gameStateRef.current = 'PAUSED';
    } else if (gameStateRef.current === 'PAUSED') {
      lastStepTimeRef.current = performance.now();
      setGameState('PLAYING');
      gameStateRef.current = 'PLAYING';
    }
  }, []);

  const queueDirection = useCallback((nextDir: Direction) => {
    if (gameStateRef.current === 'TITLE_MENU') {
      startNewGame(true);
    }
    if (gameStateRef.current !== 'PLAYING') return;

    const queue = inputQueueRef.current;
    const referenceDir = queue.length > 0 ? queue[queue.length - 1] : directionRef.current;
    if (nextDir === referenceDir || OPPOSITE[referenceDir] === nextDir) {
      return;
    }
    if (queue.length < 2) {
      queue.push(nextDir);
    }
  }, [startNewGame]);

  // Global keyboard bindings for responsive Snake control
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          queueDirection('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          queueDirection('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          queueDirection('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          queueDirection('RIGHT');
          break;
        case ' ':
          e.preventDefault();
          if (gameStateRef.current === 'TITLE_MENU' || gameStateRef.current === 'GAME_OVER') {
            startNewGame(true);
          } else {
            togglePause();
          }
          break;
        case 'Enter':
          if (gameStateRef.current === 'TITLE_MENU' || gameStateRef.current === 'GAME_OVER') {
            e.preventDefault();
            startNewGame(true);
          }
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          startNewGame(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [queueDirection, startNewGame, togglePause]);

  // Main high-FPS animation & fixed-step game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;
    let lastFrameTime = performance.now();

    const getTickInterval = () => {
      const cfg = SPEED_CONFIG[speedRef.current];
      return Math.max(cfg.minTickMs, cfg.baseTickMs - applesRef.current * cfg.stepAccelMs);
    };

    const stepSimulation = (now: number) => {
      const snake = snakeRef.current;
      prevSnakeRef.current = snake.map((p) => ({ ...p }));

      if (inputQueueRef.current.length > 0) {
        const next = inputQueueRef.current.shift()!;
        if (OPPOSITE[directionRef.current] !== next) {
          directionRef.current = next;
        }
      }

      const head = snake[0];
      let nx = head.x;
      let ny = head.y;
      if (directionRef.current === 'UP') ny -= 1;
      if (directionRef.current === 'DOWN') ny += 1;
      if (directionRef.current === 'LEFT') nx -= 1;
      if (directionRef.current === 'RIGHT') nx += 1;

      if (wallModeRef.current === 'wrap') {
        nx = (nx + GRID_SIZE) % GRID_SIZE;
        ny = (ny + GRID_SIZE) % GRID_SIZE;
      } else {
        if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) {
          triggerGameOver();
          return;
        }
      }

      const ateFood = nx === foodRef.current.x && ny === foodRef.current.y;
      const bonus = bonusRef.current;
      const ateBonus = bonus !== null && nx === bonus.pos.x && ny === bonus.pos.y;

      // Tail moves out unless snake grows on this tick
      const bodyToCheck = ateFood ? snake : snake.slice(0, snake.length - 1);
      const hitSelf = bodyToCheck.some((seg) => seg.x === nx && seg.y === ny);
      if (hitSelf) {
        triggerGameOver();
        return;
      }

      const nextSnake = [{ x: nx, y: ny }, ...snake];
      if (!ateFood) {
        nextSnake.pop();
      }
      snakeRef.current = nextSnake;

      if (bonus && now > bonus.expiresAt) {
        bonusRef.current = null;
      }

      if (ateFood) {
        const withinStreak = now - lastEatTimeRef.current < 4500;
        const nextStreak = withinStreak ? streakRef.current + 1 : 1;
        streakRef.current = nextStreak;
        lastEatTimeRef.current = now;

        const points = 10 + Math.min(nextStreak - 1, 5) * 2;
        scoreRef.current += points;
        applesRef.current += 1;

        setScore(scoreRef.current);
        setApples(applesRef.current);
        setStreak(nextStreak);
        setSnakeLength(nextSnake.length);
        if (scoreRef.current > bestScoreRef.current) {
          setIsNewBest(true);
        }

        const activeTrack = trackRef.current;
        spawnParticles({ x: nx, y: ny }, activeTrack.foodHex, 16);
        floatersRef.current.push({
          x: nx + 0.5,
          y: ny + 0.2,
          text: `+${points}`,
          color: activeTrack.foodHex,
          life: 1,
        });
        synthEngine.playEatSfx(nextStreak);

        const occupied = [...nextSnake];
        if (bonusRef.current) occupied.push(bonusRef.current.pos);
        foodRef.current = randomEmptyCell(occupied);

        // Every 5 apples, spawn a timed Harmonic Bonus Orb
        if (applesRef.current % 5 === 0 && !bonusRef.current) {
          const bonusPos = randomEmptyCell([...nextSnake, foodRef.current]);
          bonusRef.current = {
            pos: bonusPos,
            expiresAt: now + 6500,
            durationMs: 6500,
          };
        }
      }

      if (ateBonus && bonus) {
        const bonusPoints = 30;
        scoreRef.current += bonusPoints;
        setScore(scoreRef.current);
        if (scoreRef.current > bestScoreRef.current) {
          setIsNewBest(true);
        }
        bonusRef.current = null;
        spawnParticles({ x: nx, y: ny }, '#FACC15', 22);
        floatersRef.current.push({
          x: nx + 0.5,
          y: ny + 0.2,
          text: '+30',
          color: '#FDE047',
          life: 1,
        });
        synthEngine.playBonusSfx();
      }
    };

    const triggerGameOver = () => {
      crashFlashRef.current = 1;
      gameStateRef.current = 'GAME_OVER';
      setGameState('GAME_OVER');
      synthEngine.playGameOverSfx();

      if (scoreRef.current > 0) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        onRecordRun({
          id: `${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
          score: scoreRef.current,
          apples: applesRef.current,
          speed: speedRef.current,
          wallMode: wallModeRef.current,
          trackTitle: trackRef.current.title,
          timestamp: timeStr,
        });
      }
    };

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      const tickMs = getTickInterval();
      if (gameStateRef.current === 'PLAYING') {
        while (now - lastStepTimeRef.current >= tickMs) {
          lastStepTimeRef.current += tickMs;
          stepSimulation(now);
          if (gameStateRef.current !== 'PLAYING') break;
        }
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const displaySize = canvas.clientWidth || 520;
      const targetPixels = Math.round(displaySize * dpr);
      if (canvas.width !== targetPixels || canvas.height !== targetPixels) {
        canvas.width = targetPixels;
        canvas.height = targetPixels;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const cell = displaySize / GRID_SIZE;
      const activeTrack = trackRef.current;
      const bass = prefersReducedMotion ? 0 : synthEngine.getBassEnergy();

      // 1. Deep Obsidian Arena Canvas
      ctx.fillStyle = '#070A12';
      ctx.fillRect(0, 0, displaySize, displaySize);

      // Subtle music-reactive radial aura in center
      const aura = ctx.createRadialGradient(
        displaySize * 0.5,
        displaySize * 0.5,
        displaySize * 0.06,
        displaySize * 0.5,
        displaySize * 0.5,
        displaySize * 0.65,
      );
      aura.addColorStop(0, `${activeTrack.accentHex}${Math.round((0.06 + bass * 0.09) * 255)
        .toString(16)
        .padStart(2, '0')}`);
      aura.addColorStop(1, 'rgba(7, 10, 18, 0)');
      ctx.fillStyle = aura;
      ctx.fillRect(0, 0, displaySize, displaySize);

      // 2. Crisp Neon Grid Lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.065)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < GRID_SIZE; i++) {
        const pos = Math.round(i * cell) + 0.5;
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, displaySize);
        ctx.moveTo(0, pos);
        ctx.lineTo(displaySize, pos);
      }
      ctx.stroke();

      // Subtle inner border cue for Wall Mode
      ctx.save();
      ctx.lineWidth = 2;
      if (wallModeRef.current === 'wrap') {
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = `${activeTrack.accentHex}55`;
      } else {
        ctx.strokeStyle = `${activeTrack.accentHex}38`;
      }
      ctx.strokeRect(1, 1, displaySize - 2, displaySize - 2);
      ctx.restore();

      // 3. Draw Food Orb
      const pulse = prefersReducedMotion ? 0.5 : (Math.sin(now * 0.007) + 1) * 0.5;
      const fx = (foodRef.current.x + 0.5) * cell;
      const fy = (foodRef.current.y + 0.5) * cell;
      const foodR = cell * (0.28 + pulse * 0.06 + bass * 0.04);

      ctx.save();
      ctx.shadowColor = activeTrack.foodHex;
      ctx.shadowBlur = 14 + pulse * 8;
      ctx.fillStyle = activeTrack.foodHex;
      ctx.beginPath();
      ctx.moveTo(fx, fy - foodR * 1.25);
      ctx.lineTo(fx + foodR * 1.25, fy);
      ctx.lineTo(fx, fy + foodR * 1.25);
      ctx.lineTo(fx - foodR * 1.25, fy);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FFF1F2';
      ctx.beginPath();
      ctx.arc(fx, fy, foodR * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 4. Draw Bonus Orb if active
      const bonus = bonusRef.current;
      if (bonus) {
        const remaining = Math.max(0, (bonus.expiresAt - now) / bonus.durationMs);
        const bx = (bonus.pos.x + 0.5) * cell;
        const by = (bonus.pos.y + 0.5) * cell;
        const br = cell * 0.34;

        ctx.save();
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#FDE047';
        ctx.beginPath();
        ctx.arc(bx, by, br * 0.72, 0, Math.PI * 2);
        ctx.fill();

        // Countdown ring
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, by, br * 1.22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
        ctx.stroke();
        ctx.restore();
      }

      // 5. Draw Snake with Smooth Inter-Tick Interpolation
      const rawInterp =
        gameStateRef.current === 'PLAYING'
          ? Math.min(1, Math.max(0, (now - lastStepTimeRef.current) / tickMs))
          : 1;
      const interp = prefersReducedMotion ? 1 : rawInterp;

      const snake = snakeRef.current;
      const prevSnake = prevSnakeRef.current;

      for (let i = snake.length - 1; i >= 0; i--) {
        const curr = snake[i];
        const prev = prevSnake[Math.min(i, prevSnake.length - 1)] ?? curr;

        // Avoid stretching across the board when wrapping through portals
        const dx = Math.abs(curr.x - prev.x);
        const dy = Math.abs(curr.y - prev.y);
        const drawX = dx > 1 ? curr.x : prev.x + (curr.x - prev.x) * interp;
        const drawY = dy > 1 ? curr.y : prev.y + (curr.y - prev.y) * interp;

        const t = i / Math.max(1, snake.length - 1);
        const inset = i === 0 ? cell * 0.08 : cell * (0.12 + t * 0.14);
        const segSize = cell - inset * 2;
        const px = drawX * cell + inset;
        const py = drawY * cell + inset;
        const radius = i === 0 ? segSize * 0.34 : segSize * 0.28;

        ctx.save();
        if (i === 0) {
          ctx.shadowColor = activeTrack.accentHex;
          ctx.shadowBlur = 16 + bass * 8;
          ctx.fillStyle = activeTrack.snakeHeadHex;
        } else {
          ctx.shadowColor = activeTrack.accentHex;
          ctx.shadowBlur = Math.max(3, 10 * (1 - t));
          ctx.fillStyle = i % 2 === 0 ? activeTrack.accentHex : activeTrack.snakeTailHex;
          ctx.globalAlpha = Math.max(0.55, 1 - t * 0.38);
        }

        ctx.beginPath();
        ctx.roundRect(px, py, segSize, segSize, radius);
        ctx.fill();

        // Draw crisp eyes on Snake Head
        if (i === 0) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#07090F';
          const eyeR = Math.max(1.8, cell * 0.085);
          const cx = px + segSize * 0.5;
          const cy = py + segSize * 0.5;
          const forward = segSize * 0.2;
          const side = segSize * 0.22;

          let e1x = cx + forward;
          let e1y = cy - side;
          let e2x = cx + forward;
          let e2y = cy + side;

          if (directionRef.current === 'LEFT') {
            e1x = cx - forward;
            e1y = cy - side;
            e2x = cx - forward;
            e2y = cy + side;
          } else if (directionRef.current === 'UP') {
            e1x = cx - side;
            e1y = cy - forward;
            e2x = cx + side;
            e2y = cy - forward;
          } else if (directionRef.current === 'DOWN') {
            e1x = cx - side;
            e1y = cy + forward;
            e2x = cx + side;
            e2y = cy + forward;
          }

          ctx.beginPath();
          ctx.arc(e1x, e1y, eyeR, 0, Math.PI * 2);
          ctx.arc(e2x, e2y, eyeR, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 6. Update & Draw Particle Bursts
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.life -= dt / p.maxLife;
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x * cell, p.y * cell, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 7. Floating Score Popups
      for (let i = floatersRef.current.length - 1; i >= 0; i--) {
        const f = floatersRef.current[i];
        f.y -= dt * 1.4;
        f.life -= dt * 1.3;
        if (f.life <= 0) {
          floatersRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, f.life);
        ctx.font = '600 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x * cell, f.y * cell);
        ctx.restore();
      }

      // 8. Crash flash feedback
      if (crashFlashRef.current > 0) {
        crashFlashRef.current = Math.max(0, crashFlashRef.current - dt * 2.8);
        ctx.fillStyle = `rgba(244, 63, 94, ${crashFlashRef.current * 0.28})`;
        ctx.fillRect(0, 0, displaySize, displaySize);
      }

      ctx.restore();
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [onRecordRun, spawnParticles]);

  const displayedBest = Math.max(bestScore, score);

  return (
    <section
      id="snake-arena"
      aria-label="Snake Game Arena"
      ref={arenaContainerRef}
      className="flex flex-col rounded-2xl bg-[#0D111C] border border-white/[0.08] p-5"
    >
      {/* Integrated Score Counter HUD (Zero-Pill, Unboxed Tabular Typography) */}
      <div className="grid grid-cols-4 divide-x divide-white/[0.08] pb-4 mb-4 border-b border-white/[0.07]">
        <div className="pr-3">
          <div className="text-xs text-slate-400">Score</div>
          <div
            className="mt-0.5 text-2xl sm:text-3xl font-semibold font-mono tabular-nums tracking-tight"
            style={{ color: track.accentHex }}
          >
            {score}
          </div>
        </div>
        <div className="px-3">
          <div className="text-xs text-slate-400">Best</div>
          <div className="mt-0.5 text-2xl sm:text-3xl font-semibold font-mono tabular-nums text-slate-100">
            {displayedBest}
          </div>
        </div>
        <div className="px-3">
          <div className="text-xs text-slate-400">Length</div>
          <div className="mt-0.5 text-2xl sm:text-3xl font-semibold font-mono tabular-nums text-slate-100">
            {snakeLength}
          </div>
        </div>
        <div className="pl-3">
          <div className="text-xs text-slate-400">Streak</div>
          <div className="mt-0.5 text-2xl sm:text-3xl font-semibold font-mono tabular-nums text-slate-100">
            {streak > 1 ? `${streak}x` : '1x'}
          </div>
        </div>
      </div>

      {/* Center Square Canvas Viewport */}
      <div
        className="relative mx-auto aspect-square w-full max-w-[540px] overflow-hidden rounded-xl border border-white/[0.1] bg-[#070A12]"
        style={{
          boxShadow: `0 0 42px -12px ${track.accentGlowRgba}`,
        }}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          aria-label="Snake game board"
        />

        {/* TITLE_MENU Overlay */}
        {gameState === 'TITLE_MENU' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07090F]/80 backdrop-blur-sm p-6 text-center">
            <p className="text-xs font-mono text-slate-400 mb-2">
              Arrow Keys or WASD · Space to Pause
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight mb-2">
              Neon Snake
            </h1>
            <p className="max-w-xs text-sm text-slate-300 leading-relaxed mb-6">
              Collect glowing prisms to build your streak while the synth deck plays in sync.
            </p>
            <button
              type="button"
              onClick={() => startNewGame(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-slate-950 transition-transform duration-150 hover:brightness-110 active:scale-95 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={{
                backgroundColor: track.accentHex,
                boxShadow: `0 0 26px ${track.accentGlowRgba}`,
              }}
            >
              <Play className="h-4 w-4 fill-current" />
              Start Game
            </button>
          </div>
        )}

        {/* PAUSED Overlay */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07090F]/75 backdrop-blur-sm p-6 text-center">
            <h2 className="text-2xl font-bold text-slate-50 mb-1">Game Paused</h2>
            <p className="text-sm text-slate-300 mb-6">
              Current score <span className="font-mono tabular-nums text-white">{score}</span> ·{' '}
              {apples} collected
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePause}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-950 transition-transform duration-150 active:scale-95 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                style={{
                  backgroundColor: track.accentHex,
                  boxShadow: `0 0 20px ${track.accentGlowRgba}`,
                }}
              >
                <Play className="h-4 w-4 fill-current" />
                Resume
              </button>
              <button
                type="button"
                onClick={() => startNewGame(false)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/[0.09] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              >
                <RotateCcw className="h-4 w-4" />
                Restart
              </button>
            </div>
          </div>
        )}

        {/* GAME_OVER Overlay */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07090F]/85 backdrop-blur-sm p-6 text-center">
            <p className="text-xs font-mono text-rose-400 mb-1">
              {isNewBest ? 'New High Score' : 'Run Complete'}
            </p>
            <h2 className="text-3xl font-bold text-slate-50 mb-1">Game Over</h2>
            <div className="mt-2 mb-6 flex items-center gap-3 text-sm text-slate-300">
              <span>
                Score{' '}
                <strong
                  className="font-mono tabular-nums text-base"
                  style={{ color: track.accentHex }}
                >
                  {score}
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>
                Best <strong className="font-mono tabular-nums text-slate-100">{displayedBest}</strong>
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>
                Orbs <strong className="font-mono tabular-nums text-slate-100">{apples}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => startNewGame(false)}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-slate-950 transition-transform duration-150 hover:brightness-110 active:scale-95 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={{
                backgroundColor: track.accentHex,
                boxShadow: `0 0 26px ${track.accentGlowRgba}`,
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Play Again
            </button>
          </div>
        )}
      </div>

      {/* Arena Control Toolbar (Speed, Walls, Pause/Restart) */}
      <div className="mt-4 pt-4 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Speed segmented control */}
          <div
            role="group"
            aria-label="Game speed"
            className="inline-flex items-center rounded-lg bg-[#080B12] border border-white/[0.08] p-1"
          >
            {(Object.keys(SPEED_CONFIG) as SpeedPreset[]).map((preset) => {
              const active = speedPreset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSpeedPreset(preset)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-400 ${
                    active ? 'bg-white/[0.12] text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {SPEED_CONFIG[preset].label}
                </button>
              );
            })}
          </div>

          {/* Wall Mode segmented control */}
          <div
            role="group"
            aria-label="Arena boundary mode"
            className="inline-flex items-center rounded-lg bg-[#080B12] border border-white/[0.08] p-1"
          >
            <button
              type="button"
              onClick={() => setWallMode('solid')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-400 ${
                wallMode === 'solid'
                  ? 'bg-white/[0.12] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Solid Walls
            </button>
            <button
              type="button"
              onClick={() => setWallMode('wrap')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-400 ${
                wallMode === 'wrap'
                  ? 'bg-white/[0.12] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Wrap Edges
            </button>
          </div>
        </div>

        {/* Play/Pause & Restart Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (gameState === 'TITLE_MENU' || gameState === 'GAME_OVER') {
                startNewGame(true);
              } else {
                togglePause();
              }
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3.5 text-xs font-medium text-slate-100 hover:bg-white/[0.09] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            {gameState === 'PLAYING' ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                {gameState === 'PAUSED' ? 'Resume' : 'Play'}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => startNewGame(false)}
            aria-label="Restart game"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3.5 text-xs font-medium text-slate-300 hover:bg-white/[0.09] hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Touch D-Pad for Mobile / Compact Screens */}
      <div className="mt-4 grid grid-cols-3 gap-2 max-w-[180px] mx-auto lg:hidden">
        <div />
        <button
          type="button"
          onClick={() => queueDirection('UP')}
          aria-label="Move up"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.09] text-slate-100 active:bg-white/[0.15]"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
        <div />
        <button
          type="button"
          onClick={() => queueDirection('LEFT')}
          aria-label="Move left"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.09] text-slate-100 active:bg-white/[0.15]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => queueDirection('DOWN')}
          aria-label="Move down"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.09] text-slate-100 active:bg-white/[0.15]"
        >
          <ArrowDown className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => queueDirection('RIGHT')}
          aria-label="Move right"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.09] text-slate-100 active:bg-white/[0.15]"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}
