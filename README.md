# Astra — Chennai Decision Twin

A Chennai-focused decision-intelligence platform. The flagship use case is flood and emergency-resource allocation: it will combine sourced geographic context, user-controlled assumptions, and deterministic/probabilistic simulations.

## Phase 0 status

The repository foundation, TypeScript/Next.js app shell, Tailwind styling, environment template, shadcn-compatible component configuration, and initial documentation are present. Phase 1 adds a Chennai-centered Mapbox map with place search and click-to-select coordinates.

## Application setup

Copy `.env.example` to `.env.local`, add only the keys needed for enabled integrations, install with `pnpm install`, and start with `pnpm dev`. Server-only keys must never be prefixed with `NEXT_PUBLIC_`.

The UI is deliberately separated from API adapters and simulation logic. External data will be normalized and labelled by source, retrieval time, confidence, and status; the AI layer will invoke application tools rather than calculate simulation outcomes.

See [architecture](docs/ARCHITECTURE.md) and [API setup](docs/API_SETUP.md).

---

This application is bootstrapped with [Next.js](https://nextjs.org).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
