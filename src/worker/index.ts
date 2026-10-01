import { DurableObject } from "cloudflare:workers";
import { hiddenWord, normalizeGuess, revealMatchingParts } from "../shared/word-hint";
import { pickUniqueWord, type Difficulty } from "./wordPools";

type Mode = "solo" | "team" | "chaos";
type Phase = "lobby" | "drawing" | "reveal" | "finished" | "chaos-writing" | "chaos-drawing" | "chaos-guessing" | "album";
type Tool = "pen" | "eraser";

interface Env {
  GAME_ROOMS: DurableObjectNamespace<GameRoom>;
  ASSETS: Fetcher;
}

interface Settings {
  mode: Mode;
  difficulty: Difficulty;
  targetScore: 10 | 20 | 30;
  roundSeconds: 60 | 90 | 120;
}

interface Player {
  id: string;
  token: string;
  name: string;
  score: number;
  team: "A" | "B";
  connected: boolean;
  guessed: boolean;
  isHost: boolean;
  lastGuessAt: number;
}

interface StrokePoint { x: number; y: number }
interface Stroke {
  color: string;
  size: number;
  tool: Tool;
  points: StrokePoint[];
}

type ChaosEntry =
  | { type:"prompt"|"guess"; authorId:string; authorName:string; text:string }
  | { type:"drawing"; authorId:string; authorName:string; strokes:Stroke[] };
interface ChaosChain { id:string; ownerId:string; ownerName:string; entries:ChaosEntry[] }
interface ChaosState { playerOrder:string[]; round:number; totalRounds:number; submittedPlayerIds:string[]; chains:ChaosChain[] }

interface RoomState {
  code: string;
  phase: Phase;
  settings: Settings;
  players: Player[];
  drawerIndex: number;
  word: string;
  strokes: Stroke[];
  round: number;
  endsAt: number | null;
  revealedWord: string | null;
  revealedParts: boolean[];
  winner: string | null;
  winnerScore: number | null;
  usedWords: string[];
  chaos: ChaosState | null;
  createdAt: number;
}

interface WinnerResult {
  name: string;
  score: number;
}

interface SocketAttachment { playerId: string }

const COLORS = new Set(["#17152b", "#7357f6", "#ff5f8f", "#15cbb9", "#ffbd3d", "#2f8cff"]);
const SIZES = new Set([4, 9, 18]);

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "https://scratch.alperensenel.com",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  } });
}

function roomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 22) : "";
}

function publicPlayer(player: Player) {
  return {
    id: player.id,
    name: player.name,
    score: player.score,
    team: player.team,
    connected: player.connected,
    guessed: player.guessed,
    isHost: player.isHost,
  };
}

function assignedChain(chaos:ChaosState, playerId:string):ChaosChain|undefined {
  const playerIndex=chaos.playerOrder.indexOf(playerId);
  if (playerIndex < 0) return undefined;
  const chainIndex=(playerIndex-(chaos.round-1)+chaos.playerOrder.length)%chaos.playerOrder.length;
  return chaos.chains[chainIndex];
}

function publicState(state: RoomState, viewerId?:string) {
  const drawer = state.players[state.drawerIndex];
  const teamScores = state.players.reduce((scores, player) => {
    scores[player.team] += player.score;
    return scores;
  }, { A: 0, B: 0 });

  const chaos = state.chaos ? (() => {
    const chain=viewerId ? assignedChain(state.chaos!,viewerId) : undefined;
    const previous=chain?.entries.at(-1);
    const kind=state.chaos!.round===1 ? "write" : state.chaos!.round%2===0 ? "draw" : "guess";
    return {
      round:state.chaos!.round,totalRounds:state.chaos!.totalRounds,
      submittedCount:state.chaos!.submittedPlayerIds.length,
      submittedPlayerIds:state.chaos!.submittedPlayerIds,
      task:chain ? {chainId:chain.id,kind,submitted:state.chaos!.submittedPlayerIds.includes(viewerId!),
        ...(kind==="draw" && previous?.type!=="drawing" ? {prompt:previous?.text ?? ""} : {}),
        ...(kind==="guess" && previous?.type==="drawing" ? {drawing:previous.strokes} : {})} : undefined,
      albums:state.phase==="album" ? state.chaos!.chains.map(({id,ownerName,entries})=>({id,ownerName,entries})) : undefined,
    };
  })() : undefined;
  return {
    code: state.code,
    phase: state.phase,
    settings: state.settings,
    players: state.players.map(publicPlayer),
    drawerId: drawer?.id ?? null,
    round: state.round,
    endsAt: state.endsAt,
    revealedWord: state.revealedWord,
    wordHint: hiddenWord(state.word, state.revealedParts),
    winner: state.winner,
    winnerScore: state.winnerScore ?? null,
    teamScores,
    strokes: state.strokes,
    chaos,
  };
}

export class GameRoom extends DurableObject<Env> {
  private state: RoomState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS room_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          data TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
      const row = this.ctx.storage.sql.exec<{ data: string }>("SELECT data FROM room_state WHERE id = 1").toArray()[0];
      if (row) this.state = JSON.parse(row.data) as RoomState;
      if (this.state) {
        // Rooms created by older deployments do not have partial-word state yet.
        this.state.revealedParts ??= [];
        this.state.settings.difficulty ??= "easy";
        this.state.usedWords ??= [];
        this.state.chaos ??= null;
        for (const player of this.state.players) player.connected = false;
      }
    });
  }

  async initialize(code: string, settings: Settings): Promise<void> {
    if (this.state) return;
    this.state = {
      code,
      phase: "lobby",
      settings,
      players: [],
      drawerIndex: -1,
      word: "",
      strokes: [],
      round: 0,
      endsAt: null,
      revealedWord: null,
      revealedParts: [],
      winner: null,
      winnerScore: null,
      usedWords: [],
      chaos: null,
      createdAt: Date.now(),
    };
    this.persist();
  }

  async exists(): Promise<boolean> {
    return this.state !== null;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket bağlantısı bekleniyor.", { status: 426 });
    }
    if (!this.state) return new Response("Oda bulunamadı.", { status: 404 });

    const url = new URL(request.url);
    const name = cleanName(url.searchParams.get("name"));
    const reconnectId = url.searchParams.get("player") ?? "";
    const reconnectToken = url.searchParams.get("token") ?? "";
    if (!name) return new Response("İsim gerekli.", { status: 400 });

    let player = this.state.players.find((candidate) => candidate.id === reconnectId && candidate.token === reconnectToken);
    if (!player) {
      if (this.state.players.length >= 10) return new Response("Oda dolu.", { status: 409 });
      if (this.state.phase !== "lobby") return new Response("Oyun başladı; yeni oyuncu alınmıyor.", { status: 409 });
      player = {
        id: crypto.randomUUID(),
        token: crypto.randomUUID(),
        name,
        score: 0,
        team: this.state.players.filter((item) => item.team === "A").length <= this.state.players.filter((item) => item.team === "B").length ? "A" : "B",
        connected: true,
        guessed: false,
        isHost: this.state.players.length === 0,
        lastGuessAt: 0,
      };
      this.state.players.push(player);
    } else {
      player.connected = true;
      player.name = name;
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId: player.id } satisfies SocketAttachment);
    this.persist();

    server.send(JSON.stringify({ type: "welcome", playerId: player.id, token: player.token }));
    server.send(JSON.stringify({ type: "state", state: publicState(this.state, player.id) }));
    if (this.currentDrawer()?.id === player.id && this.state.phase === "drawing") {
      server.send(JSON.stringify({ type: "word", word: this.state.word }));
    }
    this.broadcastState();
    this.broadcast({ type: "toast", tone: "info", message: `${player.name} odaya katıldı.` }, player.id);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== "string" || raw.length > 512_000 || !this.state) return;
    const attachment = socket.deserializeAttachment() as SocketAttachment | null;
    const player = this.state.players.find((candidate) => candidate.id === attachment?.playerId);
    if (!player) return;

    let message: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
      message = parsed as Record<string, unknown>;
    } catch {
      return;
    }

    switch (message.type) {
      case "start":
        if (player.isHost && this.state.phase === "lobby" && this.state.players.length >= 2) {
          if (this.state.settings.mode === "chaos") this.startChaos();
          else this.startRound();
        }
        break;
      case "settings":
        if (player.isHost && this.state.phase === "lobby") this.updateSettings(message);
        break;
      case "team":
        if (this.state.phase === "lobby" && (message.team === "A" || message.team === "B")) {
          player.team = message.team;
          this.persist();
          this.broadcastState();
        }
        break;
      case "stroke":
        this.handleStroke(player, message);
        break;
      case "clear":
        if (this.isDrawing(player)) {
          this.state.strokes = [];
          this.persist();
          this.broadcast({ type: "clear" });
        }
        break;
      case "guess":
        this.handleGuess(socket, player, message.text);
        break;
      case "chaos-submit":
        this.handleChaosSubmit(player,message);
        break;
      case "restart":
        if (player.isHost && (this.state.phase === "finished" || this.state.phase === "album")) this.restartGame();
        break;
      case "leave":
        this.leaveRoom(socket, player);
        break;
    }
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    if (!this.state) return;
    const attachment = socket.deserializeAttachment() as SocketAttachment | null;
    const player = this.state.players.find((candidate) => candidate.id === attachment?.playerId);
    if (!player) return;
    player.connected = false;
    this.persist();
    this.broadcastState();
  }

  async alarm(): Promise<void> {
    if (!this.state) return;
    if (this.state.phase === "drawing") this.finishRound("Süre doldu!");
    else if (this.state.phase === "reveal") this.startRound();
  }

  private persist(): void {
    if (!this.state) return;
    this.ctx.storage.sql.exec(
      "INSERT INTO room_state (id, data, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
      JSON.stringify(this.state), Date.now(),
    );
  }

  private currentDrawer(): Player | undefined {
    return this.state?.players[this.state.drawerIndex];
  }

  private isDrawing(player: Player): boolean {
    return this.state?.phase === "drawing" && this.currentDrawer()?.id === player.id;
  }

  private broadcast(payload: unknown, exceptPlayerId?: string): void {
    const encoded = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as SocketAttachment | null;
      if (attachment?.playerId === exceptPlayerId) continue;
      try { socket.send(encoded); } catch { /* closed sockets are discarded by the runtime */ }
    }
  }

  private broadcastState(): void {
    if (!this.state) return;
    for (const socket of this.ctx.getWebSockets()) {
      const attachment=socket.deserializeAttachment() as SocketAttachment|null;
      try { socket.send(JSON.stringify({type:"state",state:publicState(this.state,attachment?.playerId)})); } catch { /* closed */ }
    }
  }

  private updateSettings(message: Record<string, unknown>): void {
    if (!this.state) return;
    const mode = message.mode;
    const difficulty=message.difficulty;
    const targetScore = Number(message.targetScore);
    const roundSeconds = Number(message.roundSeconds);
    if ((mode === "solo" || mode === "team" || mode === "chaos") && ["easy","medium","hard","apocalypse","funny"].includes(String(difficulty)) && [10, 20, 30].includes(targetScore) && [60, 90, 120].includes(roundSeconds)) {
      this.state.settings = {
        mode,
        difficulty:difficulty as Difficulty,
        targetScore: targetScore as Settings["targetScore"],
        roundSeconds: roundSeconds as Settings["roundSeconds"],
      };
      this.persist();
      this.broadcastState();
    }
  }

  private startRound(): void {
    if (!this.state || this.state.players.length < 2) return;
    this.state.drawerIndex = (this.state.drawerIndex + 1) % this.state.players.length;
    this.state.round += 1;
    this.state.phase = "drawing";
    this.state.word = pickUniqueWord(this.state.settings.difficulty,this.state.usedWords);
    this.state.usedWords.push(this.state.word);
    this.state.strokes = [];
    this.state.revealedWord = null;
    this.state.revealedParts = [];
    this.state.winner = null;
    this.state.winnerScore = null;
    this.state.endsAt = Date.now() + this.state.settings.roundSeconds * 1000;
    for (const player of this.state.players) player.guessed = false;
    this.persist();
    void this.ctx.storage.setAlarm(this.state.endsAt);
    this.broadcast({ type: "round", drawerId: this.currentDrawer()?.id });
    this.broadcastState();
    const drawerSocket = this.socketFor(this.currentDrawer()?.id);
    drawerSocket?.send(JSON.stringify({ type: "word", word: this.state.word }));
  }

  private startChaos():void {
    if (!this.state || this.state.players.length < 2) return;
    const order=this.state.players.map(player=>player.id);
    this.state.chaos={
      playerOrder:order,round:1,totalRounds:order.length,submittedPlayerIds:[],
      chains:this.state.players.map(player=>({id:crypto.randomUUID(),ownerId:player.id,ownerName:player.name,entries:[]})),
    };
    this.state.phase="chaos-writing";
    this.state.round=1;
    this.state.endsAt=null;
    this.state.strokes=[];
    this.persist();
    void this.ctx.storage.deleteAlarm();
    this.broadcastState();
  }

  private sanitizeStrokes(value:unknown):Stroke[] {
    if (!Array.isArray(value)) return [];
    return value.slice(0,600).flatMap((raw):Stroke[]=>{
      if (!raw || typeof raw!=="object") return [];
      const item=raw as Record<string,unknown>;
      const color=typeof item.color==="string" && COLORS.has(item.color) ? item.color : "#17152b";
      const size=Number(item.size);
      const tool:Tool=item.tool==="eraser" ? "eraser" : "pen";
      if (!SIZES.has(size) || !Array.isArray(item.points)) return [];
      const points=item.points.slice(0,80).flatMap((rawPoint):StrokePoint[]=>{
        if (!rawPoint || typeof rawPoint!=="object") return [];
        const point=rawPoint as Record<string,unknown>,x=Number(point.x),y=Number(point.y);
        return Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=1&&y>=0&&y<=1 ? [{x,y}] : [];
      });
      return points.length>=2 ? [{color,size,tool,points}] : [];
    });
  }

  private handleChaosSubmit(player:Player,message:Record<string,unknown>):void {
    if (!this.state?.chaos || !this.state.phase.startsWith("chaos-")) return;
    const chaos=this.state.chaos;
    if (!chaos.playerOrder.includes(player.id) || chaos.submittedPlayerIds.includes(player.id)) return;
    const chain=assignedChain(chaos,player.id);
    if (!chain || message.chainId!==chain.id) return;
    const base={authorId:player.id,authorName:player.name};
    if (chaos.round%2===0) {
      const strokes=this.sanitizeStrokes(message.strokes);
      if (!strokes.length) return;
      chain.entries.push({type:"drawing",...base,strokes});
    } else {
      const text=typeof message.text==="string" ? message.text.trim().replace(/\s+/g," ").slice(0,120) : "";
      if (!text) return;
      chain.entries.push({type:chaos.round===1 ? "prompt" : "guess",...base,text});
    }
    chaos.submittedPlayerIds.push(player.id);
    if (chaos.submittedPlayerIds.length===chaos.playerOrder.length) {
      if (chaos.round>=chaos.totalRounds) {
        this.state.phase="album";
      } else {
        chaos.round+=1;
        chaos.submittedPlayerIds=[];
        this.state.round=chaos.round;
        this.state.phase=chaos.round%2===0 ? "chaos-drawing" : "chaos-guessing";
      }
    }
    this.persist();
    this.broadcastState();
  }

  private handleStroke(player: Player, message: Record<string, unknown>): void {
    if (!this.state || !this.isDrawing(player)) return;
    const color = typeof message.color === "string" && COLORS.has(message.color) ? message.color : "#17152b";
    const size = Number(message.size);
    const tool = message.tool === "eraser" ? "eraser" : "pen";
    const rawPoints = Array.isArray(message.points) ? message.points.slice(0, 40) : [];
    const points = rawPoints.flatMap((point): StrokePoint[] => {
      if (!point || typeof point !== "object") return [];
      const candidate = point as Record<string, unknown>;
      const x = Number(candidate.x);
      const y = Number(candidate.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return [];
      return [{ x, y }];
    });
    if (points.length < 2 || !SIZES.has(size)) return;
    const stroke: Stroke = { color, size, tool, points };
    this.state.strokes.push(stroke);
    if (this.state.strokes.length > 2_000) this.state.strokes = this.state.strokes.slice(-1_500);
    this.persist();
    this.broadcast({ type: "stroke", stroke });
  }

  private handleGuess(socket: WebSocket, player: Player, rawText: unknown): void {
    if (!this.state || this.state.phase !== "drawing" || this.isDrawing(player) || player.guessed) return;
    const text = typeof rawText === "string" ? rawText.trim().slice(0, 80) : "";
    if (!text) return;
    const now = Date.now();
    const retryAfter = 1_500 - (now - player.lastGuessAt);
    if (retryAfter > 0) {
      socket.send(JSON.stringify({ type: "cooldown", retryAfter }));
      return;
    }
    player.lastGuessAt = now;
    if (normalizeGuess(text) !== normalizeGuess(this.state.word)) {
      const partial = revealMatchingParts(this.state.word, this.state.revealedParts, text);
      if (!partial.matched) {
        this.broadcast({ type: "guess", playerId: player.id, name: player.name, text });
        return;
      }
      this.state.revealedParts = partial.revealedParts;
      this.broadcast({ type: "partial", playerId: player.id, name: player.name, word: text });
      if (!partial.complete) {
        this.persist();
        this.broadcastState();
        return;
      }
    }

    player.guessed = true;
    player.score += 1;
    const drawer = this.currentDrawer();
    if (drawer) drawer.score += 1;
    this.broadcast({ type: "correct", playerId: player.id, name: player.name });

    // The first correct guess ends the turn, even when other players have not guessed.
    this.finishRound("Kelime bulundu!");
  }

  private getWinner(): WinnerResult | null {
    if (!this.state) return null;
    if (this.state.settings.mode === "solo") {
      const highestScore = Math.max(...this.state.players.map((player) => player.score));
      if (highestScore < this.state.settings.targetScore) return null;
      const leaders = this.state.players.filter((player) => player.score === highestScore);
      return { name: leaders.map((player) => player.name).join(" & "), score: highestScore };
    }
    const scores = this.state.players.reduce((result, player) => {
      result[player.team] += player.score;
      return result;
    }, { A: 0, B: 0 });
    const highestScore = Math.max(scores.A, scores.B);
    if (highestScore < this.state.settings.targetScore) return null;
    if (scores.A === scores.B) return { name: "Mor Takım & Mint Takım", score: highestScore };
    if (scores.A > scores.B) return { name: "Mor Takım", score: scores.A };
    if (scores.B > scores.A) return { name: "Mint Takım", score: scores.B };
    return null;
  }

  private finishRound(message: string): void {
    if (!this.state || this.state.phase !== "drawing") return;
    const winner = this.getWinner();
    if (winner) {
      this.state.phase = "finished";
      this.state.endsAt = null;
      this.state.revealedWord = this.state.word;
      this.state.winner = winner.name;
      this.state.winnerScore = winner.score;
      this.persist();
      void this.ctx.storage.deleteAlarm();
      this.broadcast({ type: "game-over", winner: winner.name, score: winner.score });
      this.broadcastState();
      return;
    }
    this.state.phase = "reveal";
    this.state.endsAt = Date.now() + 2_200;
    this.state.revealedWord = this.state.word;
    this.state.winner = null;
    this.state.winnerScore = null;
    this.state.usedWords = [];
    this.state.chaos = null;
    this.persist();
    void this.ctx.storage.setAlarm(this.state.endsAt);
    this.broadcast({ type: "reveal", message, word: this.state.word });
    this.broadcastState();
  }

  private restartGame(): void {
    if (!this.state) return;
    for (const player of this.state.players) {
      player.score = 0;
      player.guessed = false;
    }
    this.state.drawerIndex = -1;
    this.state.round = 0;
    this.state.phase = "lobby";
    this.state.strokes = [];
    this.state.endsAt = null;
    this.state.revealedWord = null;
    this.state.revealedParts = [];
    this.state.winner = null;
    this.state.winnerScore = null;
    this.persist();
    this.broadcastState();
  }

  private leaveRoom(socket: WebSocket, player: Player): void {
    if (!this.state) return;
    const leavingIndex = this.state.players.findIndex((candidate) => candidate.id === player.id);
    if (leavingIndex < 0) return;
    const wasDrawer = this.currentDrawer()?.id === player.id;
    const wasDrawing = this.state.phase === "drawing";
    const wasChaos = this.state.settings.mode === "chaos" && this.state.phase !== "lobby";
    const name = player.name;
    this.state.players.splice(leavingIndex, 1);

    if (this.state.players.length === 0) {
      this.state.phase = "lobby";
      this.state.drawerIndex = -1;
      this.state.endsAt = null;
      this.state.strokes = [];
      this.persist();
      void this.ctx.storage.deleteAlarm();
      socket.close(1000, "Odadan ayrıldın.");
      return;
    }

    if (player.isHost) this.state.players[0].isHost = true;
    if (leavingIndex < this.state.drawerIndex) this.state.drawerIndex -= 1;

    if (wasChaos || (this.state.players.length < 2 && this.state.phase !== "lobby")) {
      this.state.phase = "lobby";
      this.state.drawerIndex = -1;
      this.state.endsAt = null;
      this.state.strokes = [];
      this.state.revealedWord = null;
      this.state.revealedParts = [];
      this.state.winner = null;
      this.state.winnerScore = null;
      this.state.chaos = null;
      void this.ctx.storage.deleteAlarm();
    } else if (wasDrawer && wasDrawing) {
      this.state.drawerIndex = (leavingIndex - 1 + this.state.players.length) % this.state.players.length;
      this.persist();
      this.finishRound("Çizen oyuncu odadan ayrıldı.");
    }

    this.persist();
    this.broadcast({ type: "toast", tone: "info", message: `${name} odadan ayrıldı.` });
    this.broadcastState();
    socket.close(1000, "Odadan ayrıldın.");
  }

  private socketFor(playerId: string | undefined): WebSocket | undefined {
    if (!playerId) return undefined;
    return this.ctx.getWebSockets().find((socket) => (socket.deserializeAttachment() as SocketAttachment | null)?.playerId === playerId);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
        return new Response(null, { status: 204, headers: {
          "Access-Control-Allow-Origin": "https://scratch.alperensenel.com",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        } });
      }
      if (url.pathname === "/api/rooms" && request.method === "POST") {
        const body: unknown = await request.json();
        const candidate = body && typeof body === "object" ? body as Record<string, unknown> : {};
        const settings: Settings = {
          mode: candidate.mode === "team" || candidate.mode === "chaos" ? candidate.mode : "solo",
          difficulty: ["easy","medium","hard","apocalypse","funny"].includes(String(candidate.difficulty)) ? candidate.difficulty as Difficulty : "easy",
          targetScore: [10, 20, 30].includes(Number(candidate.targetScore)) ? Number(candidate.targetScore) as Settings["targetScore"] : 10,
          roundSeconds: [60, 90, 120].includes(Number(candidate.roundSeconds)) ? Number(candidate.roundSeconds) as Settings["roundSeconds"] : 90,
        };
        const code = roomCode();
        await env.GAME_ROOMS.getByName(code).initialize(code, settings);
        return json({ code }, 201);
      }

      const match = url.pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})\/socket$/);
      if (match && request.method === "GET") {
        if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ error: "WebSocket gerekli." }, 426);
        const stub = env.GAME_ROOMS.getByName(match[1]);
        if (!await stub.exists()) return json({ error: "Oda bulunamadı." }, 404);
        return stub.fetch(request);
      }

      if (url.pathname.startsWith("/api/")) return json({ error: "Bulunamadı." }, 404);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(JSON.stringify({ message: "request_failed", path: url.pathname, error: error instanceof Error ? error.message : String(error) }));
      return json({ error: "Beklenmedik bir hata oluştu." }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
