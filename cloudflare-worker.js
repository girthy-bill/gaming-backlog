/**
 * Gaming Backlog Worker
 * GET  /games          → load all games
 * POST /games          → save/update a game
 * DELETE /games/:id    → delete a game
 * GET  /search?q=...   → search RAWG for games
 *
 * Secrets:
 *   RAWG_API_KEY — your RAWG API key
 *
 * KV Binding:
 *   BACKLOG — KV namespace
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ── GET /games ────────────────────────────────────────
    if (path === "/games" && request.method === "GET") {
      try {
        const data = await env.BACKLOG.get("games");
        const games = data ? JSON.parse(data) : [];
        return json({ games });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ── POST /games ───────────────────────────────────────
    if (path === "/games" && request.method === "POST") {
      try {
        const { game } = await request.json();
        if (!game || !game.id) return json({ error: "Invalid game" }, 400);

        const data = await env.BACKLOG.get("games");
        let games = data ? JSON.parse(data) : [];

        const idx = games.findIndex(g => g.id === game.id);
        if (idx >= 0) {
          games[idx] = game; // update existing
        } else {
          games.push(game); // add new
        }

        await env.BACKLOG.put("games", JSON.stringify(games));
        return json({ ok: true, game });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ── DELETE /games/:id ─────────────────────────────────
    if (path.startsWith("/games/") && request.method === "DELETE") {
      try {
        const id = decodeURIComponent(path.replace("/games/", ""));
        const data = await env.BACKLOG.get("games");
        let games = data ? JSON.parse(data) : [];
        games = games.filter(g => g.id !== id);
        await env.BACKLOG.put("games", JSON.stringify(games));
        return json({ ok: true });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ── GET /search?q=... ─────────────────────────────────
    if (path === "/search" && request.method === "GET") {
      try {
        const q = url.searchParams.get("q");
        if (!q) return json({ results: [] });

        const apiKey = env.RAWG_API_KEY;
        const rawgUrl = `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(q)}&page_size=8&search_precise=true`;
        const r = await fetch(rawgUrl);

        if (!r.ok) throw new Error("RAWG API returned " + r.status);
        const data = await r.json();

        return json({ results: data.results || [] });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    return new Response("Not found", { status: 404, headers: CORS });
  }
};
