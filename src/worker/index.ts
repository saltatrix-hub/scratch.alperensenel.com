import { DurableObject } from "cloudflare:workers";

type Mode = "solo" | "team";
type Phase = "lobby" | "drawing" | "reveal" | "finished";
type Tool = "pen" | "eraser";

interface Env {
  GAME_ROOMS: DurableObjectNamespace<GameRoom>;
  ASSETS: Fetcher;
}

interface Settings {
  mode: Mode;
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
  winner: string | null;
  winnerScore: number | null;
  createdAt: number;
}

interface WinnerResult {
  name: string;
  score: number;
}

interface SocketAttachment { playerId: string }

const WORDS = [
  "uçan balon", "güneş gözlüğü", "kahve fincanı", "deniz feneri", "kaykay", "penguen",
  "gökkuşağı", "patlamış mısır", "itfaiye arabası", "uyuyan kedi", "sihirli değnek",
  "kardan adam", "uzay gemisi", "kaplumbağa", "kulaklık", "fotoğraf makinesi", "pizza",
  "şemsiye", "basketbol", "kamp çadırı", "robot", "dondurma", "trafik ışığı", "gitar",
  "denizaltı", "kelebek", "çalar saat", "hazine sandığı", "helikopter", "çamaşır makinesi",
  "fil", "mikroskop", "tren", "kaktüs", "diş fırçası", "sörf tahtası", "arı kovanı"
] as const;

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

function normalizeGuess(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR").replace(/[^a-zçğıöşü0-9 ]/gi, "").replace(/\s+/g, " ");
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

function publicState(state: RoomState) {
  const drawer = state.players[state.drawerIndex];
  const teamScores = state.players.reduce((scores, player) => {
    scores[player.team] += player.score;
    return scores;
  }, { A: 0, B: 0 });

  return {
    code: state.code,
    phase: state.phase,
    settings: state.settings,
    players: state.players.map(publicPlayer),
    drawerId: drawer?.id ?? null,
    round: state.round,
    endsAt: state.endsAt,
    revealedWord: state.revealedWord,
    winner: state.winner,
    winnerScore: state.winnerScore ?? null,
    teamScores,
    strokes: state.strokes,
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
      winner: null,
      winnerScore: null,
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
    server.send(JSON.stringify({ type: "state", state: publicState(this.state) }));
    if (this.currentDrawer()?.id === player.id && this.state.phase === "drawing") {
      server.send(JSON.stringify({ type: "word", word: this.state.word }));
    }
    this.broadcastState();
    this.broadcast({ type: "toast", tone: "info", message: `${player.name} odaya katıldı.` }, player.id);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== "string" || raw.length > 32_000 || !this.state) return;
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
          this.startRound();
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
      case "restart":
        if (player.isHost && this.state.phase === "finished") this.restartGame();
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
    this.broadcast({ type: "state", state: publicState(this.state) });
  }

  private updateSettings(message: Record<string, unknown>): void {
    if (!this.state) return;
    const mode = message.mode;
    const targetScore = Number(message.targetScore);
    const roundSeconds = Number(message.roundSeconds);
    if ((mode === "solo" || mode === "team") && [10, 20, 30].includes(targetScore) && [60, 90, 120].includes(roundSeconds)) {
      this.state.settings = {
        mode,
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
    this.state.word = WORDS[crypto.getRandomValues(new Uint32Array(1))[0] % WORDS.length];
    this.state.strokes = [];
    this.state.revealedWord = null;
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
      this.broadcast({ type: "guess", playerId: player.id, name: player.name, text });
      return;
    }

    player.guessed = true;
    player.score += 1;
    const drawer = this.currentDrawer();
    if (drawer) drawer.score += 1;
    this.broadcast({ type: "correct", playerId: player.id, name: player.name });

    const eligible = this.state.players.filter((candidate) => candidate.id !== drawer?.id && candidate.connected);
    if (eligible.length > 0 && eligible.every((candidate) => candidate.guessed)) {
      this.finishRound("Herkes bildi!");
      return;
    }

    this.persist();
    this.broadcastState();
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

    if (this.state.players.length < 2 && this.state.phase !== "lobby") {
      this.state.phase = "lobby";
      this.state.drawerIndex = -1;
      this.state.endsAt = null;
      this.state.strokes = [];
      this.state.revealedWord = null;
      this.state.winner = null;
      this.state.winnerScore = null;
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
          mode: candidate.mode === "team" ? "team" : "solo",
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
