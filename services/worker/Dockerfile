FROM node:20-alpine

# FFmpeg for video transcoding (Phase 3)
RUN apk add --no-cache ffmpeg

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

COPY dist ./dist

CMD ["node", "dist/index.js"]
