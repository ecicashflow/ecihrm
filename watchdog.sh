#!/bin/bash
# Watchdog that keeps the dev server alive
cd /home/z/my-project
while true; do
  if ! lsof -ti:3000 >/dev/null 2>&1; then
    echo "[$(date)] Port 3000 free — starting dev server..." >> /home/z/my-project/watchdog.log
    nohup bun run dev >> /home/z/my-project/dev.log 2>&1 &
    DEV_PID=$!
    echo "[$(date)] Dev server PID: $DEV_PID" >> /home/z/my-project/watchdog.log
    # Wait for server to bind to port 3000 (up to 30 seconds)
    for i in $(seq 1 30); do
      if lsof -ti:3000 >/dev/null 2>&1; then
        echo "[$(date)] Server bound to port 3000" >> /home/z/my-project/watchdog.log
        break
      fi
      sleep 1
    done
    # Extra cooldown to prevent double-start
    sleep 10
  fi
  sleep 10
done
