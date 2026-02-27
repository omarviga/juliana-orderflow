#!/usr/bin/env bash

set -u

APP_DIR="${APP_DIR:-/home/tato/juliana-orderflow}"
LOG_DIR="${LOG_DIR:-$APP_DIR/logs}"
LOG_FILE="${LOG_FILE:-$LOG_DIR/bluetooth.log}"

# MAC addresses
IMPRESORA_80MM="${IMPRESORA_80MM:-AB:0A:FA:8F:3C:AA}"
IMPRESORA_58MM="${IMPRESORA_58MM:-86:67:7A:A9:3C:5F}"

# RFCOMM channels on the bluetooth printers (usually 1)
RFCOMM_CHANNEL="${RFCOMM_CHANNEL:-1}"

mkdir -p "$LOG_DIR"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG_FILE"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "ERROR: command not found: $1"
    return 1
  fi
  return 0
}

prepare_bluetooth() {
  if command -v bluetoothctl >/dev/null 2>&1; then
    bluetoothctl power on >/dev/null 2>&1 || true
  fi
}

conectar_impresora() {
  local mac="$1"
  local puerto="$2"
  local nombre="$3"

  log "Conectando $nombre ($mac) en /dev/rfcomm$puerto"

  rfcomm release "$puerto" >/dev/null 2>&1 || true

  if command -v bluetoothctl >/dev/null 2>&1; then
    bluetoothctl trust "$mac" >/dev/null 2>&1 || true
    bluetoothctl connect "$mac" >/dev/null 2>&1 || true
  fi

  if rfcomm bind "$puerto" "$mac" "$RFCOMM_CHANNEL"; then
    log "OK: $nombre conectada en /dev/rfcomm$puerto"
    return 0
  fi

  log "ERROR: fallo al conectar $nombre"
  return 1
}

main() {
  log "Iniciando conexion Bluetooth de impresoras"

  local missing=0
  require_cmd rfcomm || missing=1
  if [[ "$missing" -ne 0 ]]; then
    log "Abortado: faltan comandos requeridos"
    return 1
  fi

  prepare_bluetooth

  local failed=0
  conectar_impresora "$IMPRESORA_80MM" 0 "GLPrinter 80mm" || failed=1
  conectar_impresora "$IMPRESORA_58MM" 1 "PT210A 58mm" || failed=1

  log "Verificando /dev/rfcomm*"
  ls -la /dev/rfcomm* >>"$LOG_FILE" 2>&1 || true

  if [[ "$failed" -ne 0 ]]; then
    log "Finalizado con errores"
    return 1
  fi

  log "Finalizado correctamente"
  return 0
}

main "$@"
