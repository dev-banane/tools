# Tools by Jakob Pütz

Personal developer tools (DNS, IP, security, generators). React/Vite frontend + Cloudflare Worker API.

## Develop

```bash
npm install
npm run icons   # after adding HugeIcons
npm run dev
```

## Deploy (Cloudflare Workers + assets)

```bash
npm run deploy
```

Requires Wrangler auth (`npx wrangler login`). Worker name: `devjakob-tools`.

## API

| Route | Purpose |
|-------|---------|
| `GET /api/health` | Health check |
| `GET /api/ip?ip=` | Visitor or lookup IP geo |
| `GET /api/dns?host=&type=` | Multi-resolver DNS |
| `GET /api/headers?url=` | Headers + redirect chain |
| `GET /api/ttfb?url=&samples=` | Edge latency samples |
| `GET /api/security?url=` | Security grade report |
| `GET /api/subdomains?host=` | CT subdomain discovery |
| `GET /api/domain?name=&tlds=` | Domain availability across TLDs (RDAP) |
