#!/bin/bash
# macOS: bu dosyaya çift tıklayın (ilk seferde sağ tık → Aç).
cd "$(dirname "$0")" || exit 1

PORT="${PORT:-3000}"
URL="http://localhost:$PORT"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  Node.js bulunamadı."
  echo "  https://nodejs.org adresinden LTS sürümünü kurup bu dosyayı tekrar çalıştır."
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
  open "$URL" 2>/dev/null
) &

PORT="$PORT" exec node server.js
