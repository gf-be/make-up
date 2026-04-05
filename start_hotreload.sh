#!/bin/bash

echo "Starting Backend with Hot Reload..."
cd backend
npm run dev &
BACKEND_PID=$!

sleep 3

echo "Starting Frontend with Hot Reload..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Both servers are running with hot reload enabled!"
echo "Backend: http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all servers"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
