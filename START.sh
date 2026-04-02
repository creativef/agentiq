#!/bin/bash
# Quick start script - run this from your MacBook
# First make sure you're authenticated with GitHub (has ssh key or gh auth login)

echo "Pulling latest code from GitHub..."
git pull origin main

echo ""
echo "Starting Mission Control..."
echo "- Docker will spin up Postgres and the app"
echo "- Frontend will be at http://localhost:5173"
echo "- API will be at http://localhost:3000"
echo ""

docker compose up --build
