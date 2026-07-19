# syntax=docker/dockerfile:1

FROM node:24-alpine AS build

WORKDIR /workspace
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile \
  && pnpm --filter @gym-platform/workers build \
  && pnpm --filter @gym-platform/workers --prod deploy --legacy /opt/runtime

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system app && adduser --system --ingroup app app

COPY --from=build --chown=app:app /opt/runtime ./

USER app

CMD ["node", "dist/main.js"]
