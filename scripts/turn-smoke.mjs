import assert from "node:assert/strict";
import { hiddenWord } from "../src/shared/word-hint.ts";

const base = process.env.SCRATCH_URL?.replace(/\/$/, "");
if (!base) throw new Error("SCRATCH_URL is required");

function connect(code, name) {
  const url = new URL(`${base.replace(/^http/, "ws")}/api/rooms/${code}/socket`);
  url.searchParams.set("name", name);
  const ws = new WebSocket(url);
  const messages = [];
  ws.addEventListener("message", (event) => messages.push(JSON.parse(event.data)));

  function waitFor(predicate, label, from = messages.length, timeout = 8_000) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        ws.removeEventListener("message", check);
        ws.removeEventListener("error", fail);
        ws.removeEventListener("close", fail);
      };
      const check = () => {
        const message = messages.slice(from).find(predicate);
        if (!message) return;
        cleanup();
        resolve(message);
      };
      const fail = () => {
        cleanup();
        reject(new Error(`Connection closed while waiting for ${label}`));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for ${label}`));
      }, timeout);
      ws.addEventListener("message", check);
      ws.addEventListener("error", fail);
      ws.addEventListener("close", fail);
      check();
    });
  }

  return {
    ws, messages, waitFor,
    send: (message) => ws.send(JSON.stringify(message)),
    state: (predicate, label, from) => waitFor(
      (message) => message.type === "state" && predicate(message.state), label, from,
    ).then((message) => message.state),
  };
}

async function smoke(mode, playerCount) {
  const clients = [];
  try {
    const response = await fetch(`${base}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, targetScore: 10, roundSeconds: 60 }),
    });
    assert.equal(response.status, 201, "Room creation must succeed");
    const { code } = await response.json();
    const ids = [];
    for (let index = 0; index < playerCount; index += 1) {
      const client = connect(code, `Test ${index + 1}`);
      clients.push(client);
      const welcome = await client.waitFor((message) => message.type === "welcome", "welcome", 0);
      ids.push(welcome.playerId);
    }
    const host = clients[0];
    await host.state((state) => state.players.length === playerCount, "all players joined", 0);
    const start = clients.map((client) => client.messages.length);
    host.send({ type: "start" });
    let word = (await host.waitFor((message) => message.type === "word", "first private word", start[0])).word;
    const scores = Array(playerCount).fill(0);
    let partialChecked = false;

    for (let turn = 0; turn < playerCount; turn += 1) {
      const drawerIndex = turn % playerCount;
      // With three players the correct guesser is deliberately not the next drawer.
      const guesserIndex = (drawerIndex + playerCount - 1) % playerCount;
      const nextDrawerIndex = (drawerIndex + 1) % playerCount;
      const drawer = clients[drawerIndex];
      const guesser = clients[guesserIndex];
      const drawing = await host.state((state) => state.phase === "drawing" && state.round === turn + 1, "drawing round", 0);
      assert.equal(drawing.drawerId, ids[drawerIndex]);
      assert.equal(drawing.strokes.length, 0, "Every round starts with an empty canvas");
      assert.equal(drawing.wordHint, hiddenWord(word), "Guessers see a length-preserving hidden phrase");

      const beforeStroke = clients.map((client) => client.messages.length);
      const stroke = { type: "stroke", color: "#17152b", size: 9, tool: "pen", points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }] };
      drawer.send(stroke);
      await Promise.all(clients.map((client, index) => client.waitFor(
        (message) => message.type === "stroke", "drawing sync", beforeStroke[index],
      )));

      if (!partialChecked && word.includes(" ")) {
        const partialFrom = host.messages.length;
        const firstPart = word.split(" ")[0];
        guesser.send({ type: "guess", text: firstPart });
        const partialState = await host.state(
          (state) => state.phase === "drawing" && state.wordHint.startsWith(`${firstPart} `),
          "partial word reveal", partialFrom,
        );
        assert.deepEqual(partialState.players.map((player) => player.score), scores, "A partial word does not award points");
        partialChecked = true;
        await new Promise((resolve) => setTimeout(resolve, 1_550));
      }

      const beforeGuess = clients.map((client) => client.messages.length);
      guesser.send({ type: "guess", text: word });
      const reveals = await Promise.all(clients.map((client, index) => client.state(
        (state) => state.phase === "reveal", "round end after the FIRST correct guess", beforeGuess[index],
      )));
      scores[drawerIndex] += 1;
      scores[guesserIndex] += 1;
      for (const reveal of reveals) {
        assert.equal(reveal.revealedWord, word);
        assert.deepEqual(reveal.players.map((player) => player.score), scores);
        assert.equal(reveal.players.filter((player) => player.guessed).length, 1);
        assert.ok(reveal.endsAt - Date.now() <= 3_000, "Next turn must start after the short reveal");
      }

      // Extra guesses and strokes during reveal must not affect scores or the next canvas.
      for (const client of clients) client.send({ type: "guess", text: word });
      drawer.send(stroke);
      const nextStates = await Promise.all(clients.map((client, index) => client.state(
        (state) => state.phase === "drawing" && state.round === turn + 2,
        "automatic next drawing turn", beforeGuess[index],
      )));
      for (const state of nextStates) {
        assert.equal(state.drawerId, ids[nextDrawerIndex], "Drawing order follows the player list");
        assert.deepEqual(state.players.map((player) => player.score), scores, "No duplicate scoring during reveal");
        assert.ok(state.players.every((player) => !player.guessed), "Guess status resets each turn");
        assert.equal(state.strokes.length, 0);
        assert.equal(state.revealedWord, null);
        assert.ok(state.endsAt > Date.now(), "New drawer gets a fresh timer");
      }
      word = (await clients[nextDrawerIndex].waitFor(
        (message) => message.type === "word", "next drawer's private word", beforeGuess[nextDrawerIndex],
      )).word;
      for (let index = 0; index < clients.length; index += 1) {
        const events = clients[index].messages.slice(beforeGuess[index]);
        assert.equal(events.filter((message) => message.type === "correct").length, 1);
        assert.ok(!events.some((message) => message.type === "state" && message.state.phase === "drawing" && message.state.players.some((player) => player.guessed)));
        if (index !== nextDrawerIndex) assert.ok(!events.some((message) => message.type === "word"), "Word stays private to the drawer");
      }
    }

    for (let index = clients.length - 1; index > 0; index -= 1) {
      const from = host.messages.length;
      clients[index].send({ type: "leave" });
      await host.state((state) => state.players.length === index, "player departure", from);
    }
    const finalState = host.messages.filter((message) => message.type === "state").at(-1).state;
    assert.equal(finalState.phase, "lobby");
    assert.equal(finalState.endsAt, null);
    console.log(JSON.stringify({ ok: true, mode, playerCount, partialWordFlow: partialChecked, firstGuessEndsRound: true, fullDrawerRotation: true, privateWords: true, scoring: true, drawingSync: true, leaveFlow: true }));
  } finally {
    await Promise.all(clients.map(({ ws, send }) => new Promise((resolve) => {
      if (ws.readyState === WebSocket.CLOSED) return resolve();
      const timer = setTimeout(() => { ws.close(1000); resolve(); }, 2_000);
      ws.addEventListener("close", () => { clearTimeout(timer); resolve(); }, { once: true });
      if (ws.readyState === WebSocket.OPEN) send({ type: "leave" });
      else ws.close();
    })));
  }
}

await smoke("solo", 3);
await smoke("solo", 2);
await smoke("team", 3);
