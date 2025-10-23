#!/bin/bash
# Force restart script to clear Node.js cache

echo "🛑 Killing all Node processes..."
pkill -f "node.*server.js"
pkill -f "npm.*start"
killall node 2>/dev/null

echo "⏳ Waiting 2 seconds..."
sleep 2

echo "🧹 Clearing Node.js cache..."
rm -rf node_modules/.cache 2>/dev/null

echo "✅ Ready to start fresh!"
echo "Run: npm start"
