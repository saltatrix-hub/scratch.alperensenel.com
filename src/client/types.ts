export type Mode = "solo" | "team";
export type Phase = "lobby" | "drawing" | "reveal" | "finished";

export interface Player {
  id: string;
  name: string;
  score: number;
  team: "A" | "B";
  connected: boolean;
  guessed: boolean;
  isHost: boolean;
}

export interface StrokePoint { x: number; y: number }
export interface Stroke {
  color: string;
  size: number;
  tool: "pen" | "eraser";
  points: StrokePoint[];
}

export interface GameState {
  code: string;
  phase: Phase;
  settings: { mode: Mode; targetScore: 10 | 20 | 30; roundSeconds: 60 | 90 | 120 };
  players: Player[];
  drawerId: string | null;
  round: number;
  endsAt: number | null;
  revealedWord: string | null;
  winner: string | null;
  teamScores: { A: number; B: number };
  strokes: Stroke[];
}

export interface FeedItem {
  id: string;
  tone: "normal" | "correct" | "info";
  text: string;
}
