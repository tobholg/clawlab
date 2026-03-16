# Contributing

## Getting started

1. Clone `https://github.com/tobholg/clawlab.git`
2. Copy `.env.example` to `.env`
3. Set `JWT_SECRET`
4. Run `npm install`
5. Run `npm run dev`

By default, local development uses SQLite via `./data/context.db`. Set `DATABASE_URL` only if you want PostgreSQL.

## Before opening a pull request

- Keep changes scoped and explain the user-visible impact
- Update docs when setup, behavior, or configuration changes
- Run `npm run typecheck`
- Run `npm run build`
- Do not commit secrets, tokens, or local `.env` files

## Pull requests

- Open focused PRs rather than bundling unrelated work
- Include screenshots or short recordings for UI changes
- Call out migrations, breaking changes, or new env vars clearly

## Code style

- Follow existing project patterns
- Prefer clear names over clever abstractions
- Keep public setup paths simple and documented
