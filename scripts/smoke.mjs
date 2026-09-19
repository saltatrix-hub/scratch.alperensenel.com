const base = process.env.SCRATCH_URL;
if (!base) throw new Error("SCRATCH_URL is required");

const response = await fetch(`${base}/api/rooms`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mode: "solo", targetScore: 10, roundSeconds: 60 }),
});
if (!response.ok) throw new Error(`Room create failed: ${response.status}`);
const { code } = await response.json();

function socket(name) {
  const url = new URL(`${base.replace(/^http/, "ws")}/api/rooms/${code}/socket`);
  url.searchParams.set("name", name);
  return new WebSocket(url);
}

function waitFor(ws, type, timeout = 8_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), timeout);
    const listener = (event) => {
      const message = JSON.parse(event.data);
      if (message.type !== type) return;
      clearTimeout(timer);
      ws.removeEventListener("message", listener);
      resolve(message);
    };
    ws.addEventListener("message", listener);
  });
}

function waitForState(ws, predicate, label, timeout = 8_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), timeout);
    const listener = (event) => {
      const message = JSON.parse(event.data);
      if (message.type !== "state" || !predicate(message.state)) return;
      clearTimeout(timer);
      ws.removeEventListener("message", listener);
      resolve(message.state);
    };
    ws.addEventListener("message", listener);
  });
}

const host = socket("Kalem");
await new Promise((resolve, reject) => { host.onopen = resolve; host.onerror = reject; });
await waitFor(host, "welcome");
const guest = socket("Tahminci");
await new Promise((resolve, reject) => { guest.onopen = resolve; guest.onerror = reject; });
await waitFor(guest, "welcome");

const wordPromise = waitFor(host, "word");
host.send(JSON.stringify({ type: "start" }));
const { word } = await wordPromise;
const hostStrokePromise = waitFor(host, "stroke");
const guestStrokePromise = waitFor(guest, "stroke");
host.send(JSON.stringify({
  type: "stroke",
  color: "#17152b",
  size: 9,
  tool: "pen",
  points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }],
}));
await Promise.all([hostStrokePromise, guestStrokePromise]);
const correctPromise = waitFor(guest, "correct");
const roundEndPromise = waitForState(host, (state) => state.phase === "reveal", "immediate round end");
const postGuessStates = [];
const stateListener = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === "state" && message.state.players.some((player) => player.guessed)) postGuessStates.push(message.state);
};
host.addEventListener("message", stateListener);
guest.send(JSON.stringify({ type: "guess", text: word }));
const [, roundEndState] = await Promise.all([correctPromise, roundEndPromise]);
host.removeEventListener("message", stateListener);
if (roundEndState.endsAt - Date.now() > 3_000) throw new Error("Round did not end promptly after every guesser answered");
if (postGuessStates.some((state) => state.phase === "drawing")) throw new Error("Server emitted a stale drawing state after the final correct guess");

const leavePromise = waitForState(host, (state) => state.players.length === 1, "leave state");
guest.send(JSON.stringify({ type: "leave" }));
await leavePromise;

host.close(1000);
guest.close(1000);
console.log(JSON.stringify({ ok: true, room: code, wordDeliveredPrivately: true, drawingSync: true, scoringFlow: true, allGuessersEndRound: true, leaveFlow: true }));
