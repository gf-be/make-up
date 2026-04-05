@echo off
echo Starting Backend with Hot Reload...
start cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting Frontend with Hot Reload...
start cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are running with hot reload enabled!
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Press any key to stop all servers...
pause >nul
taskkill /F /IM node.exe
