# Frontend (apps/web)

Quick steps to run the Next.js frontend for local development.

Prerequisites
- Node.js (recommended LTS)
- npm

Install dependencies

```powershell
cd apps/web
npm install
```

Start dev server

```powershell
npm run dev
# opens at http://localhost:3000
```

Environment

- The frontend reads `NEXT_PUBLIC_API_BASE_URL` or defaults to `http://localhost:5000`.
- You can create a `.env.local` in `apps/web` to override values.

Integration

- For full-stack dev, start the Backend API at http://localhost:5000 and (optionally) the WhatsApp service at http://localhost:5100.
