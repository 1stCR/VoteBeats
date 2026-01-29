#!/bin/bash
echo "Starting VoteBeats development server..."
cd "$(dirname "$0")/client"
PORT=3000 npm start &
echo "Development server starting on http://localhost:3000"
echo "Wait ~10 seconds for the server to be ready..."
