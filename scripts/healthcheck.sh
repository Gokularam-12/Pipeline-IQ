#!/bin/bash

API="http://localhost:3000"
LOG="logs/healthcheck.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

check_api() {
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API/health)
  if [ "$STATUS" = "200" ]; then
    echo "$DATE [OK] API is healthy"
  else
    echo "$DATE [ERROR] API down (HTTP $STATUS) — restarting..."
    pm2 restart pipelineiq-api
  fi
}

check_redis() {
  if redis-cli ping > /dev/null 2>&1; then
    echo "$DATE [OK] Redis is healthy"
  else
    echo "$DATE [ERROR] Redis down — restarting..."
    sudo service redis-server restart
  fi
}

check_ollama() {
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:11434/api/tags)
  if [ "$STATUS" = "200" ]; then
    echo "$DATE [OK] Ollama is healthy"
  else
    echo "$DATE [WARN] Ollama down — restarting..."
    ollama serve > /dev/null 2>&1 &
  fi
}

mkdir -p logs
check_api | tee -a $LOG
check_redis | tee -a $LOG
check_ollama | tee -a $LOG
