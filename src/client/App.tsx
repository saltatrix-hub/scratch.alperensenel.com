import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brush, Check, Clock3, Copy, Crown, Eraser, LogIn, Paintbrush, Play, RotateCcw, Sparkles, Users, Volume2, VolumeX, X } from "lucide-react";
import type { FeedItem, GameState, Mode, Stroke, StrokePoint } from "./types";

const PALETTE = ["#17152b", "#7357f6", "#ff5f8f", "#15cbb9", "#ffbd3d", "#2f8cff"];
const SIZES = [{ value: 4, label: "İnce" }, { value: 9, label: "Orta" }, { value: 18, label: "Kalın" }];

function sessionKey(code: string) { return `scratch-session-${code}`; }

function soundEngine() {
  let context: AudioContext | null = null;
  const tone = (frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.05) => {
    context ??= new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  };
  return {
    tick: () => tone(780, 0.08, "square", 0.025),
    correct: () => { tone(523, 0.25); window.setTimeout(() => tone(784, 0.34), 90); },
    start: () => { tone(330, 0.18); window.setTimeout(() => tone(660, 0.25), 120); },
  };
}

const sounds = soundEngine();

export default function App() {
  const params = new URLSearchParams(location.search);
  const initialRoom = params.get("room")?.toUpperCase() ?? "";
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [roomCode, setRoomCode] = useState(initialRoom);
  const [name, setName] = useState(localStorage.getItem("scratch-name") ?? "");
  const [mode, setMode] = useState<Mode>("solo");
  const [targetScore, setTargetScore] = useState<10 | 20 | 30>(10);
  const [roundSeconds, setRoundSeconds] = useState<60 | 90 | 120>(90);
  const [state, setState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [word, setWord] = useState("");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [celebrate, setCelebrate] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const tickRef = useRef<number | null>(null);

  const addFeed = useCallback((text: string, tone: FeedItem["tone"] = "normal") => {
    setFeed((items) => [...items.slice(-9), { id: crypto.randomUUID(), text, tone }]);
  }, []);

  const connect = useCallback((code: string, playerName: string) => {
    if (!playerName.trim() || code.length !== 6) return;
    setConnecting(true);
    setError("");
    localStorage.setItem("scratch-name", playerName.trim());
    const saved = JSON.parse(localStorage.getItem(sessionKey(code)) ?? "{}") as { playerId?: string; token?: string };
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const query = new URLSearchParams({ name: playerName.trim() });
    if (saved.playerId && saved.token) {
      query.set("player", saved.playerId);
      query.set("token", saved.token);
    }
    const ws = new WebSocket(`${protocol}://${location.host}/api/rooms/${code}/socket?${query}`);
    socketRef.current = ws;
    ws.onopen = () => {
      setScreen("game");
      setRoomCode(code);
      setConnecting(false);
      history.replaceState(null, "", `?room=${code}`);
    };
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data as string) as Record<string, unknown>;
      if (message.type === "welcome") {
        const id = String(message.playerId);
        setPlayerId(id);
        localStorage.setItem(sessionKey(code), JSON.stringify({ playerId: id, token: message.token }));
      } else if (message.type === "state") {
        setState(message.state as unknown as GameState);
      } else if (message.type === "word") {
        setWord(String(message.word));
      } else if (message.type === "guess") {
        addFeed(`${message.name}: ${message.text}`);
      } else if (message.type === "correct") {
        addFeed(`${message.name} doğru bildi! +1`, "correct");
        setCelebrate((value) => value + 1);
        if (!muted) sounds.correct();
      } else if (message.type === "toast") {
        addFeed(String(message.message), "info");
      } else if (message.type === "round") {
        setWord("");
        addFeed("Yeni tur başladı. Kalem sıradaki oyuncuda!", "info");
        if (!muted) sounds.start();
      } else if (message.type === "reveal") {
        addFeed(`${message.message} Kelime: ${message.word}`, "info");
      } else if (message.type === "cooldown") {
        addFeed("Biraz bekle, sonra tekrar tahmin et.", "info");
      } else if (message.type === "game-over") {
        setCelebrate((value) => value + 1);
        if (!muted) sounds.correct();
      }
    };
    ws.onclose = (event) => {
      setConnecting(false);
      if (event.code !== 1000) setError(event.reason || "Odaya bağlanılamadı. Kod doğru mu?");
    };
    ws.onerror = () => setError("Bağlantı kurulamadı. Biraz sonra tekrar dene.");
  }, [addFeed, muted]);

  useEffect(() => () => socketRef.current?.close(1000), []);

  useEffect(() => {
    if (!state?.endsAt || (state.phase !== "drawing" && state.phase !== "reveal")) {
      setRemaining(0);
      return;
    }
    const update = () => {
      const next = Math.max(0, Math.ceil((state.endsAt! - Date.now()) / 1000));
      setRemaining(next);
      if (state.phase === "drawing" && next <= 10 && next > 0 && tickRef.current !== next) {
        tickRef.current = next;
        if (!muted) sounds.tick();
      }
    };
    update();
    const id = window.setInterval(update, 200);
    return () => window.clearInterval(id);
  }, [state?.endsAt, state?.phase, muted]);

  const createRoom = async () => {
    if (!name.trim()) { setError("Önce adını yaz."); return; }
    setConnecting(true);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, targetScore, roundSeconds }),
      });
      const data = await response.json() as { code?: string; error?: string };
      if (!response.ok || !data.code) throw new Error(data.error || "Oda oluşturulamadı.");
      connect(data.code, name);
    } catch (reason) {
      setConnecting(false);
      setError(reason instanceof Error ? reason.message : "Oda oluşturulamadı.");
    }
  };

  if (screen === "home") {
    return <Home
      name={name} setName={setName} roomCode={roomCode} setRoomCode={setRoomCode}
      mode={mode} setMode={setMode} targetScore={targetScore} setTargetScore={setTargetScore}
      roundSeconds={roundSeconds} setRoundSeconds={setRoundSeconds}
      onCreate={createRoom} onJoin={() => connect(roomCode.toUpperCase(), name)}
      connecting={connecting} error={error}
    />;
  }

  if (!state) return <Loading />;
  return <Game
    state={state} playerId={playerId} word={word} feed={feed} socket={socketRef.current}
    remaining={remaining} muted={muted} setMuted={setMuted} celebrate={celebrate}
  />;
}

interface HomeProps {
  name: string; setName: (value: string) => void;
  roomCode: string; setRoomCode: (value: string) => void;
  mode: Mode; setMode: (value: Mode) => void;
  targetScore: 10 | 20 | 30; setTargetScore: (value: 10 | 20 | 30) => void;
  roundSeconds: 60 | 90 | 120; setRoundSeconds: (value: 60 | 90 | 120) => void;
  onCreate: () => void; onJoin: () => void; connecting: boolean; error: string;
}

function Home(props: HomeProps) {
  return <main className="home-shell">
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <nav className="topbar"><Brand /><span className="live-pill"><i /> CANLI OYUN</span></nav>
    <section className="home-grid">
      <div className="intro">
        <div className="eyebrow"><Sparkles size={16} /> KALEM SENDE</div>
        <h1>Çiz.<br/><span>Tahmin ettir.</span><br/>Puanı kap.</h1>
        <p>Arkadaşlarını odaya çağır. Kelimeyi yalnızca çizen görsün, diğerleri çizgilerden yakalasın.</p>
        <div className="stat-row"><span><b>10</b> oyuncuya kadar</span><span><b>3</b> süre seçeneği</span><span><b>∞</b> kahkaha</span></div>
      </div>
      <div className="setup-card">
        <div className="card-title"><span>Oyun odası</span><small>30 saniyede hazır</small></div>
        <label>Oyundaki adın<input value={props.name} maxLength={22} onChange={(event) => props.setName(event.target.value)} placeholder="Örn. Alperen" autoComplete="nickname" /></label>
        <div className="segmented"><button className={props.mode === "solo" ? "active" : ""} onClick={() => props.setMode("solo")}><Crown size={17}/> Solo</button><button className={props.mode === "team" ? "active" : ""} onClick={() => props.setMode("team")}><Users size={17}/> Ekipli</button></div>
        <OptionRow label="Bitiş puanı" values={[10,20,30]} value={props.targetScore} onChange={(value) => props.setTargetScore(value as 10|20|30)} suffix=" puan" />
        <OptionRow label="Çizim süresi" values={[60,90,120]} value={props.roundSeconds} onChange={(value) => props.setRoundSeconds(value as 60|90|120)} suffix=" sn" />
        <button className="primary-button" onClick={props.onCreate} disabled={props.connecting}><Paintbrush size={19}/>{props.connecting ? "Oda hazırlanıyor…" : "Yeni oda oluştur"}</button>
        <div className="divider"><span>veya kodla katıl</span></div>
        <div className="join-row"><input aria-label="Oda kodu" value={props.roomCode} maxLength={6} onChange={(event) => props.setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))} placeholder="ABC123" /><button onClick={props.onJoin} disabled={props.connecting || props.roomCode.length !== 6}><LogIn size={18}/> Katıl</button></div>
        {props.error && <div className="error-box"><X size={16}/>{props.error}</div>}
      </div>
    </section>
    <footer>alperensenel.com tarafından sevgiyle çizildi.</footer>
  </main>;
}

function OptionRow({ label, values, value, onChange, suffix }: { label: string; values: number[]; value: number; onChange: (value: number) => void; suffix: string }) {
  return <div className="option-block"><span>{label}</span><div className="option-row">{values.map((item) => <button key={item} className={value === item ? "active" : ""} onClick={() => onChange(item)}>{item}{suffix}</button>)}</div></div>;
}

function Brand() { return <div className="brand"><span className="brand-mark"><Brush size={20}/></span><b>SCRATCH!</b></div>; }
function Loading() { return <div className="loading"><Brand/><span className="spinner"/>Oda hazırlanıyor…</div>; }

function Game({ state, playerId, word, feed, socket, remaining, muted, setMuted, celebrate }: {
  state: GameState; playerId: string; word: string; feed: FeedItem[]; socket: WebSocket | null;
  remaining: number; muted: boolean; setMuted: (value: boolean) => void; celebrate: number;
}) {
  const me = state.players.find((player) => player.id === playerId);
  const drawer = state.players.find((player) => player.id === state.drawerId);
  const isDrawer = state.drawerId === playerId;
  const send = (payload: unknown) => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify(payload));
  const copyRoom = async () => {
    await navigator.clipboard.writeText(`${location.origin}?room=${state.code}`);
  };

  return <main className="game-shell">
    <Confetti burst={celebrate} />
    <header className="game-header">
      <Brand />
      <div className="room-code"><small>ODA KODU</small><button onClick={copyRoom}>{state.code}<Copy size={15}/></button></div>
      <div className="header-actions"><span className="round-label">TUR {Math.max(1,state.round)}</span><button className="icon-button" aria-label={muted ? "Sesi aç" : "Sesi kapat"} onClick={() => setMuted(!muted)}>{muted ? <VolumeX/> : <Volume2/>}</button></div>
    </header>
    <div className="game-layout">
      <aside className="players-panel">
        <div className="panel-head"><span>Oyuncular</span><small>{state.players.length}/10</small></div>
        {state.settings.mode === "team" && <div className="team-score"><span><i className="team-a"/>Mor <b>{state.teamScores.A}</b></span><span><i className="team-b"/>Mint <b>{state.teamScores.B}</b></span></div>}
        <div className="player-list">{[...state.players].sort((a,b) => b.score-a.score).map((player, index) => <div className={`player-item ${player.id === state.drawerId ? "drawing" : ""} ${!player.connected ? "offline" : ""}`} key={player.id}>
          <span className={`avatar team-${player.team.toLowerCase()}`}>{player.name.charAt(0).toLocaleUpperCase("tr-TR")}</span>
          <span className="player-name">{player.name}{player.id === playerId && <small>sen</small>}{player.isHost && <Crown size={12}/>}</span>
          {player.id === state.drawerId ? <Brush className="drawing-icon" size={17}/> : player.guessed ? <Check className="check-icon" size={17}/> : <b>{player.score}</b>}
          {index === 0 && state.phase !== "lobby" && <span className="leader-dot"/>}
        </div>)}</div>
        {state.phase === "lobby" && state.settings.mode === "team" && <div className="team-switch"><span>Takımın</span><button className={me?.team === "A" ? "active a" : ""} onClick={() => send({type:"team",team:"A"})}>Mor</button><button className={me?.team === "B" ? "active b" : ""} onClick={() => send({type:"team",team:"B"})}>Mint</button></div>}
      </aside>

      <section className="board-column">
        <div className={`round-banner ${remaining <= 10 && state.phase === "drawing" ? "danger" : ""}`}>
          <div>{state.phase === "lobby" ? <><small>HAZIRLIK</small><strong>Herkes gelince başlat</strong></> : state.phase === "finished" ? <><small>OYUN BİTTİ</small><strong>{state.winner} kazandı!</strong></> : isDrawer ? <><small>ÇİZECEĞİN KELİME</small><strong>{word || "Hazırlan…"}</strong></> : <><small>{drawer?.name?.toLocaleUpperCase("tr-TR")} ÇİZİYOR</small><strong>{state.phase === "reveal" ? state.revealedWord : `${wordHint(state, word)}`}</strong></>}</div>
          {state.phase !== "lobby" && state.phase !== "finished" && <div className="timer"><Clock3 size={20}/><b>{remaining}</b><small>sn</small></div>}
        </div>
        <DrawingBoard state={state} isDrawer={isDrawer} send={send}/>
        {state.phase === "lobby" && <LobbyOverlay state={state} isHost={Boolean(me?.isHost)} send={send}/>} 
        {state.phase === "finished" && <div className="finish-overlay"><Sparkles size={34}/><h2>{state.winner} kazandı!</h2><p>Çizgiler konuştu, puanlar sahibini buldu.</p>{me?.isHost ? <button className="primary-button" onClick={() => send({type:"restart"})}><RotateCcw size={18}/> Yeniden oyna</button> : <span>Ev sahibi yeni oyunu başlatabilir.</span>}</div>}
      </section>

      <aside className="chat-panel">
        <div className="panel-head"><span>Tahminler</span><small>1,5 sn bekleme</small></div>
        <div className="feed"><div className="feed-info">Çizgilere bak, kelimeyi yakala. Doğru cevabı yazınca hem sen hem çizen +1 puan alır.</div>{feed.map((item) => <div key={item.id} className={`feed-item ${item.tone}`}>{item.text}</div>)}</div>
        <GuessBox disabled={state.phase !== "drawing" || isDrawer || Boolean(me?.guessed)} onGuess={(text) => send({type:"guess",text})}/>
      </aside>
    </div>
  </main>;
}

function wordHint(state: GameState, word: string) {
  if (state.phase === "reveal") return state.revealedWord || "";
  if (word) return word;
  return "_ ".repeat(7).trim();
}

function LobbyOverlay({ state, isHost, send }: { state: GameState; isHost: boolean; send: (value: unknown) => void }) {
  return <div className="lobby-overlay"><span className="lobby-art"><Brush size={38}/></span><h2>Oda hazır!</h2><p>Kodu arkadaşlarınla paylaş. En az 2 oyuncu olduğunda çizim başlayabilir.</p><div className="lobby-settings"><span>{state.settings.mode === "solo" ? "Solo" : "Ekipli"}</span><span>{state.settings.targetScore} puan</span><span>{state.settings.roundSeconds} saniye</span></div>{isHost ? <button className="primary-button" disabled={state.players.length < 2} onClick={() => send({type:"start"})}><Play size={18}/> Oyunu başlat</button> : <div className="waiting"><i/>Ev sahibi bekleniyor</div>}</div>;
}

function GuessBox({ disabled, onGuess }: { disabled: boolean; onGuess: (value: string) => void }) {
  const [value, setValue] = useState("");
  const submit = () => {
    if (!value.trim() || disabled) return;
    onGuess(value);
    setValue("");
  };
  return <div className="guess-box"><input disabled={disabled} value={value} maxLength={80} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder={disabled ? "Şimdi tahmin edemezsin" : "Tahminini yaz…"}/><button onClick={submit} disabled={disabled || !value.trim()}><Play size={17}/></button></div>;
}

function DrawingBoard({ state, isDrawer, send }: { state: GameState; isDrawer: boolean; send: (payload: unknown) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(PALETTE[0]);
  const [size, setSize] = useState(9);
  const [tool, setTool] = useState<"pen"|"eraser">("pen");
  const activeRef = useRef<StrokePoint[]>([]);
  const rafRef = useRef<number | null>(null);

  const drawStroke = useCallback((context: CanvasRenderingContext2D, stroke: Stroke, width: number, height: number) => {
    if (stroke.points.length < 2) return;
    context.save();
    context.beginPath();
    context.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
    for (let index = 1; index < stroke.points.length; index++) context.lineTo(stroke.points[index].x * width, stroke.points[index].y * height);
    context.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
    context.lineWidth = stroke.size;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
    context.restore();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const redraw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.floor(rect.width * ratio);
      canvas.height = Math.floor(rect.height * ratio);
      const context = canvas.getContext("2d")!;
      context.scale(ratio, ratio);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, rect.width, rect.height);
      for (const stroke of state.strokes) drawStroke(context, stroke, rect.width, rect.height);
    };
    redraw();
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [state.strokes, drawStroke]);

  const pointFor = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };
  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || state.phase !== "drawing") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activeRef.current = [pointFor(event)];
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    activeRef.current.push(pointFor(event));
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(() => {
      const points = activeRef.current;
      if (points.length >= 2) {
        send({ type: "stroke", color, size, tool, points: points.slice(-40) });
        activeRef.current = [points[points.length - 1]];
      }
      rafRef.current = null;
    });
  };
  const end = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const points = activeRef.current;
    if (points.length >= 2) send({ type: "stroke", color, size, tool, points: points.slice(-40) });
    activeRef.current = [];
  };

  return <div className="board-wrap">
    {isDrawer && state.phase === "drawing" && <div className="toolbar">
      <div className="colors">{PALETTE.map((item) => <button aria-label={`${item} rengi`} key={item} className={color === item && tool === "pen" ? "selected" : ""} style={{background:item}} onClick={() => {setColor(item); setTool("pen");}}/>)}</div>
      <div className="tool-divider"/>
      <div className="sizes">{SIZES.map((item) => <button aria-label={item.label} key={item.value} className={size === item.value ? "selected" : ""} onClick={() => setSize(item.value)}><i style={{width:item.value,height:item.value}}/></button>)}</div>
      <button className={`tool-button ${tool === "eraser" ? "selected" : ""}`} onClick={() => setTool("eraser")}><Eraser size={18}/><span>Silgi</span></button>
      <button className="tool-button clear" onClick={() => send({type:"clear"})}><RotateCcw size={17}/><span>Temizle</span></button>
    </div>}
    <canvas ref={canvasRef} className={isDrawer ? "drawable" : ""} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}/>
  </div>;
}

function Confetti({ burst }: { burst: number }) {
  const pieces = useMemo(() => Array.from({length: 26}, (_, index) => ({ id: `${burst}-${index}`, left: (index * 37) % 100, delay: (index % 6) * .05, color: PALETTE[index % PALETTE.length] })), [burst]);
  if (!burst) return null;
  return <div className="confetti" aria-hidden="true">{pieces.map((piece) => <i key={piece.id} style={{left:`${piece.left}%`,animationDelay:`${piece.delay}s`,background:piece.color}}/>)}</div>;
}
