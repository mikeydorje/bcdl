# bandcamp-codes-worker

Cloudflare Worker that serves one-time Bandcamp download codes at **mikeydorje.com/bcdl**. Visitors hit that URL and get redirected to Bandcamp's redemption page. A daily cron job rechecks redeemed codes and recycles any that are still valid.

Deployed automatically via GitHub Actions on push to `main`.

## Prerequisites

- Node.js 20+
- A Cloudflare account with Workers enabled

## Setup

1. Clone this repo
2. Install dependencies:

```bash
npm install
```

3. (First time only) Create a KV namespace and paste its ID into `wrangler.toml`:

```bash
npx wrangler kv namespace create CODES
```

## GitHub Actions Deployment

This repo auto-deploys to Cloudflare Workers on every push to `main`.

Add these **GitHub repo secrets** (Settings → Secrets and variables → Actions):

| Secret | Where to find it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template, scoped to your zone |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → right sidebar |

## Import Codes

Prepare a CSV file with one code per line (a `code` header row is optional and will be skipped):

```
code
abcd-1234
efgh-5678
```

Then run:

```bash
npm run import -- path/to/codes.csv
```

Limits: max 100 codes per import, alphanumeric and hyphens only.

## Local Development

```bash
npm run dev
```

Test grabbing a code:

```bash
curl -i http://localhost:8787/bcdl
```

Test the cron handler locally:

```bash
curl "http://localhost:8787/__scheduled?cron=0+6+*+*+*"
```

## Manual Deploy

```bash
npm run deploy
```

The cron trigger (`0 6 * * *` — daily at 06:00 UTC) is configured in `wrangler.toml` and will activate automatically on deploy.
