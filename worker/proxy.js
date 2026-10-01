/* NextForge AI proxy — Cloudflare Worker.
 *
 * Holds the Gemini API key server-side (as a Worker secret) and forwards
 * rewrite requests from the NextForge site. The key never reaches the browser.
 *
 * Deploy: dashboard → Workers & Pages → Create Worker → paste this file → Deploy.
 * Then: Settings → Variables and Secrets → add secret  GEMINI_API_KEY = <your key>
 * (free key from https://aistudio.google.com/app/apikey).
 * Optional plaintext variable: ALLOWED_ORIGIN (defaults to the Pages site below).
 */

const PROVIDER_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODEL = "gemini-2.5-flash";
const MAX_PROMPT_CHARS = 6000;
const RATE_LIMIT = 20;          // requests per minute per IP (best-effort, per-isolate)
const WINDOW_MS = 60_000;

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > WINDOW_MS) hits.delete(k);
  }
  return arr.length > RATE_LIMIT;
}

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "https://k1sh0r3.github.io";
    const cors = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return new Response("Use POST", { status: 405, headers: cors });

    const origin = request.headers.get("Origin") || "";
    if (origin && origin !== allowedOrigin) {
      return new Response("Forbidden", { status: 403, headers: cors });
    }
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (rateLimited(ip)) return new Response("Rate limited, try again shortly.", { status: 429, headers: cors });

    let body;
    try { body = await request.json(); }
    catch { return new Response("Bad JSON", { status: 400, headers: cors }); }
    const prompt = String(body.prompt || "").slice(0, MAX_PROMPT_CHARS);
    if (!prompt.trim()) return new Response("Empty prompt", { status: 400, headers: cors });
    if (!env.GEMINI_API_KEY) return new Response("Server misconfigured: GEMINI_API_KEY not set", { status: 500, headers: cors });

    const upstream = await fetch(PROVIDER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.GEMINI_API_KEY },
      body: JSON.stringify({
        model: MODEL, temperature: 0.4,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};
