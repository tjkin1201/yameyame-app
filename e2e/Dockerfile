# Playwright E2E Tests Docker Container
FROM mcr.microsoft.com/playwright:v1.40.0-focal

# Set working directory
WORKDIR /app

# Install Node.js dependencies
COPY package*.json ./
RUN npm ci

# Copy test files
COPY . .

# Install Playwright browsers
RUN npx playwright install --with-deps

# Set environment variables
ENV API_URL=http://host.docker.internal:3000
ENV BASE_URL=http://host.docker.internal:8081
ENV NODE_ENV=test

# Create results directory
RUN mkdir -p test-results

# Default command
CMD ["npm", "test"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "console.log('E2E test container is healthy')"

# Labels
LABEL maintainer="yameyame-team"
LABEL description="E2E tests for YameYame React Native app"
LABEL version="1.0.0"