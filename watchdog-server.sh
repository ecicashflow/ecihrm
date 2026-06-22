#!/bin/bash
# Check if server is responding on port 3000
if ! curl -s -o /dev/null -m 5 http://localhost:3000/ 2>/dev/null; then
  # Server is down — kill any stale processes and restart
  lsof -ti:3000 2>/dev/null | xargs -r kill -9 2>/dev/null
  pkill -f "next-server" 2>/dev/null
  sleep 2
  # Start server in background with setsid
  setsid /home/z/my-project/run-server.sh > /home/z/my-project/dev.log 2>&1 &
fi
