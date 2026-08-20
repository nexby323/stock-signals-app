# Use an official Node.js runtime as a parent image (Version 22 for Prisma support)
FROM node:22-slim

# Install OpenSSL (Required by Prisma engine)
RUN apt-get update -y && apt-get install -y openssl

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the Prisma schema and the rest of the application code
COPY . .

# Generate Prisma Client specifically for the Docker OS (Linux)
RUN DATABASE_URL="postgresql://dummy" DIRECT_URL="postgresql://dummy" npx prisma generate

# Expose port 3000 for the React Native mobile app
EXPOSE 3000

# The startup command is handled in docker-compose (db push + start server)