# ====== Stage 1: Build ======
FROM node:lts-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy all source files
COPY . .

# Compile TypeScript
# RUN npx tsc -p tsconfig.json
RUN npm run build

# Delete the src folder after compilation
RUN rm -rf src

# ====== Stage 2: Production ======
FROM node:lts-alpine

WORKDIR /app

# Copy only the compiled build folder and package.json (if needed for runtime)
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm install --production

# Run the app
CMD ["npm", "run", "start"]
