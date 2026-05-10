export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if ((url.pathname === "/spark-download/status" || url.pathname === "/spark-download/status/") && request.method === "GET") {
      const count = await getOrRebuildAvailableCount(env);
      const updatedAt = (await env.CODES.get("meta:available_count_updated_at")) || null;

      return Response.json(
        {
          available: count,
          updated_at: updatedAt,
        },
        {
          status: 200,
          headers: {
            "access-control-allow-origin": "*",
            "cache-control": "public, max-age=30",
          },
        },
      );
    }

    if ((url.pathname === "/spark" || url.pathname === "/spark/") && request.method === "GET") {
      return Response.redirect("https://mikeydorje.com/links/", 301);
    }

    if ((url.pathname === "/spark-download/claim" || url.pathname === "/spark-download/claim/") && request.method === "POST") {
      const code = await dispenseCode(env);
      if (!code) {
        return Response.json(
          { available: false },
          {
            status: 200,
            headers: {
              "access-control-allow-origin": "*",
              "cache-control": "no-store",
            },
          },
        );
      }
      return Response.json(
        {
          available: true,
          code,
          redeem_url: `https://bandcamp.com/yum?code=${encodeURIComponent(code)}`,
          manual_url: "https://mikeydorje.bandcamp.com/yum",
        },
        {
          status: 200,
          headers: {
            "access-control-allow-origin": "*",
            "cache-control": "no-store",
          },
        },
      );
    }

    if ((url.pathname === "/spark-download" || url.pathname === "/spark-download/") && request.method === "GET") {
      const code = await dispenseCode(env);

      if (!code) {
        return new Response(
          `<!doctype html><html><head><meta charset="utf-8"><title>No codes</title></head><body><h1>No codes available right now.</h1><p>Please check back later.</p></body></html>`,
          {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          },
        );
      }

      return Response.redirect(
        `https://bandcamp.com/yum?code=${encodeURIComponent(code)}`,
        302,
      );
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },

  async scheduled(event, env, ctx) {
    // No-op. Previously this verified `redeemed:` codes by fetching
    // https://bandcamp.com/yum?code=X — but Bandcamp counts each fetch as a
    // redemption attempt, which burns codes ("used too many times"). Codes are
    // now treated as terminal once dispensed: available -> redeemed -> stays.
    // Cron is left wired up so we can add safe maintenance tasks later.
    return;
  },
};

async function listCodesByPrefix(kv, prefix) {
  const codes = [];
  let cursor = null;

  do {
    const opts = { prefix, limit: 1000 };
    if (cursor) opts.cursor = cursor;

    const list = await kv.list(opts);
    for (const key of list.keys) {
      codes.push(key.name.slice(prefix.length));
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);

  return codes;
}

async function setAvailableCount(env, count) {
  const next = Math.max(0, Number(count) || 0);
  const nowIso = new Date().toISOString();
  await Promise.all([
    env.CODES.put("meta:available_count", String(next)),
    env.CODES.put("meta:available_count_updated_at", nowIso),
  ]);
}

async function getOrRebuildAvailableCount(env) {
  const raw = await env.CODES.get("meta:available_count");
  const parsed = Number.parseInt(raw || "", 10);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }

  const codes = await listCodesByPrefix(env.CODES, "available:");
  const count = codes.length;
  await setAvailableCount(env, count);
  return count;
}

async function adjustAvailableCount(env, delta) {
  const current = await getOrRebuildAvailableCount(env);
  const next = Math.max(0, current + delta);
  await setAvailableCount(env, next);
}

async function dispenseCode(env) {
  const list = await env.CODES.list({ prefix: "available:", limit: 1 });
  if (list.keys.length === 0) {
    await setAvailableCount(env, 0);
    return null;
  }
  const key = list.keys[0].name;
  const code = key.slice("available:".length);
  await Promise.all([
    env.CODES.delete(`available:${code}`),
    env.CODES.put(`redeemed:${code}`, new Date().toISOString()),
  ]);
  await adjustAvailableCount(env, -1);
  return code;
}
