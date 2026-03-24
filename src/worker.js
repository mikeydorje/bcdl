export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if ((url.pathname === "/bcdl" || url.pathname === "/bcdl/") && request.method === "GET") {
      const list = await env.CODES.list({ prefix: "available:", limit: 1 });

      if (list.keys.length === 0) {
        return Response.json({ error: "No codes available" }, { status: 404 });
      }

      const key = list.keys[0].name;
      const code = key.slice("available:".length);

      await Promise.all([
        env.CODES.delete(`available:${code}`),
        env.CODES.put(`redeemed:${code}`, new Date().toISOString()),
      ]);

      return Response.redirect(
        `https://bandcamp.com/yum?code=${encodeURIComponent(code)}`,
        302,
      );
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },

  async scheduled(event, env, ctx) {
    const codes = [];
    let cursor = null;

    // Paginate through all redeemed keys
    do {
      const opts = { prefix: "redeemed:", limit: 1000 };
      if (cursor) opts.cursor = cursor;

      const list = await env.CODES.list(opts);
      for (const key of list.keys) {
        codes.push(key.name.slice("redeemed:".length));
      }
      cursor = list.list_complete ? null : list.cursor;
    } while (cursor);

    // Process in batches of 5
    for (let i = 0; i < codes.length; i += 5) {
      const batch = codes.slice(i, i + 5);

      await Promise.allSettled(
        batch.map(async (code) => {
          const res = await fetch(
            `https://bandcamp.com/yum?code=${encodeURIComponent(code)}`,
            { headers: { "User-Agent": "FriendlyBot/1.0" } },
          );

          if (res.status === 200) {
            await env.CODES.delete(`redeemed:${code}`);
            await env.CODES.put(
              `available:${code}`,
              new Date().toISOString(),
            );
          }
        }),
      );

      // Small delay between batches to avoid rate-limiting
      if (i + 5 < codes.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  },
};
