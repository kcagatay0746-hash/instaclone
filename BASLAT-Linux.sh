#!/bin/bash
# Linux: çift tıkla ya da terminalde ./BASLAT-Linux.sh
cd "$(dirname "$0")" || exit 1

PORT="${PORT:-3000}"
URL="http://localhost:$PORT"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  Node.js bulunamadı. Paket yöneticinden kur (örn. sudo apt install nodejs) ya da nodejs.org."
  echo ""
  read -r -p "  Kapatmak için Enter'a bas…"
  exit 1
fi

echo ""
echo "  Instaclone başlatılıyor… Tarayıcı birazdan açılacak."
echo "  Bu pencereyi KAPATMA. Durdurmak için Ctrl+C."
echo ""

(
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null "$URL/api/me" 2>/dev/null; then break; fi
    sleep 0.25
  done
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1
  elif command -v sensible-browser >/dev/null 2>&1; then sensible-browser "$URL" >/dev/null 2>&1
  fi
) &

PORT="$PORT" exec node server.js
