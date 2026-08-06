FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY groq-stt-server.mjs ./
USER node
EXPOSE 8787
CMD ["node", "groq-stt-server.mjs"]
