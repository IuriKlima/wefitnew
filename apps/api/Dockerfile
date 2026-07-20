# syntax=docker/dockerfile:1

FROM node:24-alpine AS build

WORKDIR /workspace
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm db:generate
RUN pnpm --filter @gym-platform/api... build
RUN pnpm --filter @gym-platform/api --prod deploy --legacy /opt/runtime

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system app && adduser --system --ingroup app app

COPY --from=build --chown=app:app /opt/runtime ./

USER app
EXPOSE 3333

CMD ["node", "dist/main.js"]
