# syntax=docker/dockerfile:1

FROM node:24-alpine AS build

WORKDIR /workspace
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV ADMIN_AUTH_ADAPTER=supabase-jwt

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

RUN corepack enable

COPY . .

RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" \
  && test -n "$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  && pnpm install --frozen-lockfile \
  && pnpm --filter @gym-platform/admin-web build \
  && pnpm --filter @gym-platform/admin-web --prod deploy --legacy /opt/runtime

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV ADMIN_AUTH_ADAPTER=supabase-jwt

RUN addgroup --system app && adduser --system --ingroup app app

COPY --from=build --chown=app:app /opt/runtime ./

USER app
EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
