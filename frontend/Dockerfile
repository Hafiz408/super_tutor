FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm install

# Copy source (overridden by bind-mount in dev)
COPY . .

EXPOSE 3000

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1
# Required for Next.js dev server to listen on all interfaces inside Docker
ENV HOSTNAME=0.0.0.0

CMD ["npm", "run", "dev"]
