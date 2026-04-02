FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000 5173

CMD ["sh", "-c", "pnpm install && pnpm -C apps/api exec tsx src/db/migrate.ts && (pnpm -C apps/api exec tsx src/server.ts & pnpm -C apps/web dev --host 0.0.0.0)"]
