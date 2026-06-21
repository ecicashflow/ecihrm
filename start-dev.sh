#!/bin/bash
# start-dev.sh — starts the Next.js dev server if not already running
# Used by cron to keep the preview alive

cd /home/z/my-project

# Check if server is already running on port 3000
if lsof -ti:3000 >/dev/null 2>&1; then
  # Verify it actually responds
  if curl -s -o /dev/null -m 3 http://localhost:3000/ 2>/dev/null; then
    echo "[$(date)] Server already running and responsive" >> /home/z/my-project/watchdog.log
    exit 0
  else
    # Port is held but not responding — kill it
    lsof -ti:3000 2>/dev/null | xargs -r kill -9 2>/dev/null
    sleep 2
  fi
fi

# Start the dev server fully detached
echo "[$(date)] Starting dev server..." >> /home/z/my-project/watchdog.log
nohup setsid bun run dev >> /home/z/my-project/dev.log 2>&1 < /dev/null &
disown 2>/dev/null

# Wait for it to be ready (up to 20 seconds)
for i in $(seq 1 20); do
  if curl -s -o /dev/null -m 2 http://localhost:3000/ 2>/dev/null; then
    echo "[$(date)] Server is ready (took ${i}s)" >> /home/z/my-project/watchdog.log
    exit 0
  fi
  sleep 1
done

echo "[$(date)] Server failed to start within 20s" >> /home/z/my-project/watchdog.log
exit 1
