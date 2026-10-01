export type Mode = "solo" | "team" | "chaos";
export type Difficulty = "easy" | "medium" | "hard" | "apocalypse" | "funny";
export type Phase = "lobby" | "drawing" | "reveal" | "finished" | "chaos-writing" | "chaos-drawing" | "chaos-guessing" | "album";

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

export type ChaosEntry =
  | { type:"prompt"|"guess"; authorId:string; authorName:string; text:string }
  | { type:"drawing"; authorId:string; authorName:string; strokes:Stroke[] };

export interface ChaosTask {
  chainId:string;
  kind:"write"|"draw"|"guess";
  prompt?:string;
  drawing?:Stroke[];
  submitted:boolean;
}

export interface ChaosView {
  round:number;
  totalRounds:number;
  submittedCount:number;
  submittedPlayerIds:string[];
  task?:ChaosTask;
  albums?:Array<{id:string; ownerName:string; entries:ChaosEntry[]}>;
}

export interface GameState {
  code: string;
  phase: Phase;
  settings: { mode: Mode; difficulty:Difficulty; targetScore: 10 | 20 | 30; roundSeconds: 60 | 90 | 120 };
  players: Player[];
  drawerId: string | null;
  round: number;
  endsAt: number | null;
  revealedWord: string | null;
  wordHint: string;
  winner: string | null;
  winnerScore: number | null;
  teamScores: { A: number; B: number };
  strokes: Stroke[];
  chaos?:ChaosView;
}

export interface FeedItem {
  id: string;
  tone: "normal" | "correct" | "info";
  text: string;
}
