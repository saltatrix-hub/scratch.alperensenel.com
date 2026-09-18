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

const host = socket("Kalem");
await new Promise((resolve, reject) => { host.onopen = resolve; host.onerror = reject; });
await waitFor(host, "welcome");
const guest = socket("Tahminci");
await new Promise((resolve, reject) => { guest.onopen = resolve; guest.onerror = reject; });
await waitFor(guest, "welcome");

const wordPromise = waitFor(host, "word");
host.send(JSON.stringify({ type: "start" }));
const { word } = await wordPromise;
const correctPromise = waitFor(guest, "correct");
guest.send(JSON.stringify({ type: "guess", text: word }));
await correctPromise;

host.close(1000);
guest.close(1000);
console.log(JSON.stringify({ ok: true, room: code, wordDeliveredPrivately: true, scoringFlow: true }));
