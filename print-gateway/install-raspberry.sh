#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-$HOME/juliana-orderflow}"
SERVICE_NAME="juliana-print-gateway"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
ENV_FILE="${APP_DIR}/print-gateway/.env"

if [[ ! -d "$APP_DIR" ]]; then
  echo "Project directory not found: $APP_DIR"
  exit 1
fi

if [[ ! -f "${APP_DIR}/print-gateway/server.mjs" ]]; then
  echo "Gateway source not found at ${APP_DIR}/print-gateway/server.mjs"
  exit 1
fi

cd "$APP_DIR"

echo "Installing Node dependencies..."
npm install

if [[ ! -f "$ENV_FILE" ]]; then
  cp "${APP_DIR}/print-gateway/.env.example" "$ENV_FILE"
  echo "Created ${ENV_FILE}. Update values before starting service."
fi

echo "Creating systemd service ${SERVICE_NAME}..."
sudo tee "$SERVICE_PATH" >/dev/null <<EOF
[Unit]
Description=Juliana Print Gateway (CUPS)
After=network.target cups.service
Wants=network.target cups.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node ${APP_DIR}/print-gateway/server.mjs
Restart=always
RestartSec=2
User=$(whoami)
Group=$(id -gn)

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"

echo "Done."
echo "Service status:"
sudo systemctl status "$SERVICE_NAME" --no-pager
echo
echo "Health check:"
curl -s "http://127.0.0.1:\${PORT:-3020}/health" || true
