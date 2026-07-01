# ─── Base Image ────────────────────────────────────────────────
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy bot package files
COPY bot/package*.json ./bot/

# Install bot dependencies using clean install (production only)
RUN npm ci --workspace=bot --omit=dev

# Copy source code (respecting .dockerignore)
COPY . .

# Set environment
ENV NODE_ENV=production

# Start the bot workspace
CMD ["npm", "start", "--workspace=bot"]
