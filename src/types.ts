export enum GameMode {
  SOLO = 'solo',
  VS = 'vs',
  STORY = 'story'
}

export enum GameStatus {
  IDLE = 'idle',
  SELECTING_MODE = 'selecting_mode',
  LOBBY = 'lobby',
  WORD_ENTRY = 'word_entry',
  PLAYING = 'playing',
  WON = 'won',
  LOST = 'lost',
  RESULTS = 'results'
}

export enum Difficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard'
}

export interface ScenarioData {
  id: string;
  word: string;
  hint: string;
  description: string;
  difficulty: Difficulty;
}

export interface GameState {
  id?: string;
  roomId?: string;
  mode: GameMode;
  word: string;
  hint: string;
  revealed: boolean[];
  guessed: string[];
  errors: number;
  maxErrors: number;
  guesserEnergy: number;
  setterEnergy: number;
  status: GameStatus;
  scenarioId: string;
  lastNarrative?: string;
  createdAt: number;
  leaderId: string;
  players: {
    uid: string;
    displayName: string;
    photoURL?: string;
    role: 'setter' | 'guesser';
  }[];
}

export const SCENARIOS: ScenarioData[] = [
  { id: 'libertad', word: 'LIBERTAD', hint: 'Lo que el elefante ansía más que el agua en verano', description: 'Elefante en jaula de savana', difficulty: Difficulty.MEDIUM },
  { id: 'nostalgia', word: 'NOSTALGIA', hint: 'Un peso dulce que vive solo en el pasado', description: 'Habitación de infancia', difficulty: Difficulty.HARD },
  { id: 'esperanza', word: 'ESPERANZA', hint: 'La llama que no se apaga aunque todo oscurezca', description: 'Faro en tormenta nocturna', difficulty: Difficulty.MEDIUM },
  { id: 'recuerdo', word: 'RECUERDO', hint: 'Un fragmento de tiempo que la mente no quiere soltar', description: 'Mente fragmentada con cristal', difficulty: Difficulty.MEDIUM },
  { id: 'silencio', word: 'SILENCIO', hint: 'El idioma que hablan los que ya no están', description: 'Bosque nevado al amanecer', difficulty: Difficulty.EASY },
  { id: 'mariposa', word: 'MARIPOSA', hint: 'Nació como una cosa, murió como otra, vivió como ambas', description: 'Jardín en metamorfosis', difficulty: Difficulty.EASY },
  { id: 'oceano', word: 'OCEANO', hint: 'Más profundo que cualquier pregunta que hayas hecho', description: 'Abismo marino bioluminiscente', difficulty: Difficulty.EASY },
  { id: 'soledad', word: 'SOLEDAD', hint: 'Una habitación con eco aunque estés acompañado', description: 'Habitación con eco', difficulty: Difficulty.EASY },
  { id: 'memoria', word: 'MEMORIA', hint: 'El primer fragmento. Todo comenzó aquí.', description: 'Cerebro de luz', difficulty: Difficulty.MEDIUM },
  { id: 'perdida', word: 'PERDIDA', hint: 'Algo se fue. No sabes qué, pero lo sientes.', description: 'Sombra en el vacío', difficulty: Difficulty.HARD },
  { id: 'buscar', word: 'BUSCAR', hint: 'El impulso que mueve al alma fragmentada.', description: 'Lupa de cristal', difficulty: Difficulty.MEDIUM },
  { id: 'luz', word: 'LUZ', hint: 'Al final. O al principio. Depende de cómo mires.', description: 'Prisma brillante', difficulty: Difficulty.EASY },
  { id: 'completo', word: 'COMPLETO', hint: 'El estado que el recuerdo siempre quiso alcanzar.', description: 'Círculo perfecto', difficulty: Difficulty.HARD }
];

export const COLORS = {
  bg: '#0A0608',
  accent: '#C8744A',
  purple: '#7B4FA0',
  gold: '#D4A843',
  teal: '#4AB8A0',
  danger: '#C84A4A'
};
