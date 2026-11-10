#!/usr/bin/env bash
# Cài GitHub Actions self-hosted runner trên máy chủ, chạy nền bằng pm2 (không cần sudo).
#
#   bash deploy/setup-runner.sh be   # runner cho repo backend (Dinhh-Chan/meetingmind)
#   bash deploy/setup-runner.sh fe   # runner cho repo giao diện (Zianggg/meeting-mind-fe)
#
# Script hỏi registration token: GitHub → repo → Settings → Actions → Runners →
# New self-hosted runner, lấy giá trị sau "--token" (hết hạn sau 1 giờ). Token
# chỉ dùng để đăng ký, không lưu lại.
set -euo pipefail

VERSION=2.338.2
# Digest GitHub công bố cho actions-runner-linux-x64-2.338.2.tar.gz.
SHA256=baebf204307bac6193480852732f0aba2ae97b6c5597c244f4d5558390147c40

case "${1:-}" in
    be) URL=https://github.com/Dinhh-Chan/meetingmind ;;
    fe) URL=https://github.com/Zianggg/meeting-mind-fe ;;
    *) echo "Dùng: $0 be|fe" >&2; exit 1 ;;
esac
NAME="iuclub-$1"
LABELS="iuclub,meetingmind-$1"
DIR="$HOME/actions-runner-$1"

mkdir -p "$DIR"
cd "$DIR"
if [ ! -x ./config.sh ]; then
    file="actions-runner-linux-x64-$VERSION.tar.gz"
    curl -fsSLo "$file" "https://github.com/actions/runner/releases/download/v$VERSION/$file"
    echo "$SHA256  $file" | sha256sum -c -
    tar xzf "$file"
    rm "$file"
fi

read -rsp "Registration token cho $URL: " TOKEN
echo
./config.sh --unattended --replace --url "$URL" --token "$TOKEN" \
    --name "$NAME" --labels "$LABELS" --work _work
unset TOKEN

# pm2 đang quản lý các ứng dụng khác trên máy chủ; dùng chung để runner tự chạy lại.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
pm2 delete "gh-runner-$1" >/dev/null 2>&1 || true
pm2 start ./run.sh --name "gh-runner-$1" --cwd "$DIR"
pm2 save
echo "Runner $NAME ($LABELS) đang chạy: pm2 logs gh-runner-$1"
