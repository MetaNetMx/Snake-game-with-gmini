export interface TrackSynthSpec {
  /** 4-bar chord progression as MIDI note arrays (each bar = 16 sixteenth steps) */
  chords: number[][];
  /** 16-step bass pattern per bar: MIDI offset from chord root, or null for rest */
  bassOffsets: (number | null)[];
  /** 16-step arpeggio index into current chord (0..chord.length-1) + octave shift */
  arpSteps: ({ index: number; octave?: number } | null)[];
  /** 64-step melodic lead (MIDI note numbers or null) */
  leadNotes: (number | null)[];
  /** 16-step drum triggers */
  kickSteps: number[];
  snareSteps: number[];
  hatSteps: number[];
  /** Timbre settings */
  bassWave: OscillatorType;
  arpWave: OscillatorType;
  leadWave: OscillatorType;
  padCutoff: number;
  arpCutoff: number;
  swing: number;
}

export interface DemoTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  mood: string;
  bpm: number;
  durationSec: number;
  coverUrl: string;
  accentHex: string;
  accentSecondaryHex: string;
  accentGlowRgba: string;
  snakeHeadHex: string;
  snakeTailHex: string;
  foodHex: string;
  synth: TrackSynthSpec;
}

export const DEMO_TRACKS: DemoTrack[] = [
  {
    id: 'midnight-grid',
    title: 'Midnight Grid',
    artist: 'Kora Synth (AI Demo)',
    genre: 'Outrun Synthwave',
    mood: 'Driving neon arpeggios & analog pulse',
    bpm: 118,
    durationSec: 144,
    coverUrl: '/src/assets/images/album_midnight_grid_1795286291449.jpg',
    accentHex: '#22D3EE',
    accentSecondaryHex: '#38BDF8',
    accentGlowRgba: 'rgba(34, 211, 238, 0.45)',
    snakeHeadHex: '#67E8F9',
    snakeTailHex: '#0284C7',
    foodHex: '#FB7185',
    synth: {
      // A minor -> F major -> C major -> G major (classic outrun)
      chords: [
        [57, 60, 64, 67], // Am7
        [53, 57, 60, 64], // Fmaj7
        [48, 52, 55, 60], // C
        [55, 59, 62, 67], // G
      ],
      bassOffsets: [0, null, 0, null, 0, null, 12, null, 0, null, 0, null, 0, 12, 7, null],
      arpSteps: [
        { index: 0, octave: 1 },
        { index: 1, octave: 1 },
        { index: 2, octave: 1 },
        { index: 3, octave: 1 },
        { index: 2, octave: 1 },
        { index: 1, octave: 1 },
        { index: 0, octave: 1 },
        { index: 2, octave: 1 },
        { index: 0, octave: 1 },
        { index: 1, octave: 1 },
        { index: 2, octave: 1 },
        { index: 3, octave: 1 },
        { index: 0, octave: 2 },
        { index: 3, octave: 1 },
        { index: 2, octave: 1 },
        { index: 1, octave: 1 },
      ],
      leadNotes: [
        76, null, null, 72, null, 74, 76, null, 79, null, null, 76, 74, null, 72, null,
        69, null, null, 72, null, 74, 76, null, 72, null, null, null, 69, null, 72, null,
        76, null, 79, null, 81, null, 79, null, 76, null, 72, null, 74, null, 76, null,
        74, null, null, 71, null, 74, 79, null, 76, null, 74, null, 71, null, null, null,
      ],
      kickSteps: [0, 4, 8, 12],
      snareSteps: [4, 12],
      hatSteps: [2, 6, 10, 14, 15],
      bassWave: 'sawtooth',
      arpWave: 'triangle',
      leadWave: 'sawtooth',
      padCutoff: 1100,
      arpCutoff: 2400,
      swing: 0.0,
    },
  },
  {
    id: 'velvet-voltage',
    title: 'Velvet Voltage',
    artist: 'Nyx Circuit (AI Demo)',
    genre: 'Dark Electro',
    mood: 'Punchy bassline & sculpted magenta shimmer',
    bpm: 126,
    durationSec: 136,
    coverUrl: '/src/assets/images/album_velvet_voltage_1795286292470.jpg',
    accentHex: '#E879F9',
    accentSecondaryHex: '#FB7185',
    accentGlowRgba: 'rgba(232, 121, 249, 0.45)',
    snakeHeadHex: '#F5D0FE',
    snakeTailHex: '#DB2777',
    foodHex: '#38BDF8',
    synth: {
      // D minor -> Bb major -> G minor -> A minor
      chords: [
        [50, 53, 57, 62], // Dm
        [46, 50, 53, 58], // Bb
        [55, 58, 62, 65], // Gm7
        [57, 60, 64, 67], // Am7
      ],
      bassOffsets: [0, 0, null, 12, 0, null, 0, 7, 0, 0, null, 12, 0, 10, 7, null],
      arpSteps: [
        { index: 0, octave: 1 },
        null,
        { index: 2, octave: 1 },
        { index: 1, octave: 1 },
        { index: 3, octave: 1 },
        null,
        { index: 2, octave: 1 },
        { index: 0, octave: 2 },
        { index: 1, octave: 1 },
        null,
        { index: 3, octave: 1 },
        { index: 2, octave: 1 },
        { index: 0, octave: 2 },
        { index: 2, octave: 1 },
        { index: 1, octave: 1 },
        null,
      ],
      leadNotes: [
        74, null, 74, null, 77, null, 81, null, 79, null, 77, null, 74, null, null, null,
        70, null, 70, null, 74, null, 77, null, 74, null, 72, null, 70, null, null, null,
        79, null, 77, null, 74, null, 70, null, 74, null, 77, null, 79, null, 81, null,
        81, null, null, 79, 77, null, 76, null, 72, null, 76, null, 79, null, null, null,
      ],
      kickSteps: [0, 4, 8, 10, 12],
      snareSteps: [4, 12, 15],
      hatSteps: [0, 2, 4, 6, 8, 10, 12, 14],
      bassWave: 'sawtooth',
      arpWave: 'square',
      leadWave: 'triangle',
      padCutoff: 950,
      arpCutoff: 1950,
      swing: 0.02,
    },
  },
  {
    id: 'aurora-drift',
    title: 'Aurora Drift',
    artist: 'Solis Wave (AI Demo)',
    genre: 'Ambient Chillwave',
    mood: 'Floating glass pads & lucid nocturnal groove',
    bpm: 94,
    durationSec: 160,
    coverUrl: '/src/assets/images/album_aurora_drift_1795286292183.jpg',
    accentHex: '#A3E635',
    accentSecondaryHex: '#A78BFA',
    accentGlowRgba: 'rgba(163, 230, 53, 0.4)',
    snakeHeadHex: '#D9F99D',
    snakeTailHex: '#65A30D',
    foodHex: '#C084FC',
    synth: {
      // E minor 9 -> C maj 7 -> G maj 7 -> D sus 2
      chords: [
        [52, 55, 59, 66], // Em9
        [48, 52, 55, 59], // Cmaj7
        [55, 59, 62, 66], // Gmaj7
        [50, 52, 57, 62], // Dsus2
      ],
      bassOffsets: [0, null, null, null, null, null, 7, null, 0, null, null, 12, null, null, 7, null],
      arpSteps: [
        { index: 0, octave: 1 },
        null,
        { index: 1, octave: 1 },
        null,
        { index: 2, octave: 1 },
        null,
        { index: 3, octave: 1 },
        null,
        { index: 2, octave: 1 },
        null,
        { index: 1, octave: 1 },
        { index: 3, octave: 1 },
        null,
        { index: 2, octave: 1 },
        null,
        { index: 0, octave: 2 },
      ],
      leadNotes: [
        79, null, null, null, 78, null, 76, null, 71, null, null, null, null, null, 74, null,
        76, null, null, null, 74, null, 71, null, 67, null, null, null, null, null, 71, null,
        74, null, null, 76, 78, null, 79, null, 83, null, null, 79, 78, null, 74, null,
        76, null, null, null, 74, null, 71, null, 69, null, null, null, null, null, null, null,
      ],
      kickSteps: [0, 6, 10],
      snareSteps: [4, 12],
      hatSteps: [2, 6, 8, 14],
      bassWave: 'triangle',
      arpWave: 'sine',
      leadWave: 'sine',
      padCutoff: 820,
      arpCutoff: 1650,
      swing: 0.04,
    },
  },
];

export function formatDuration(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
