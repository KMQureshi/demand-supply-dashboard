#!/bin/bash

echo "========================================"
echo "🚀 DEPLOYMENT SCRIPT FOR RENDER.COM"
echo "========================================"

# Step 1: Clean up
echo "1. Cleaning up..."
rm -rf node_modules
rm -f package-lock.json
rm -rf whatsapp_session

# Step 2: Check git status
echo "2. Checking git status..."
git status

# Step 3: Add all files
echo "3. Adding files to git..."
git add .

# Step 4: Commit
echo "4. Committing changes..."
git commit -m "Deploy to Render: $(date '+%Y-%m-%d %H:%M:%S')"

# Step 5: Push to GitHub
echo "5. Pushing to GitHub..."
git push origin main

echo "========================================"
echo "✅ DEPLOYMENT SCRIPT COMPLETE"
echo "Next steps:"
echo "1. Go to https://render.com"
echo "2. Create Web Service"
echo "3. Connect GitHub repository"
echo "4. Deploy!"
echo "========================================"