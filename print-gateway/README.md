# Print Gateway (Raspberry + CUPS)

Local API service to print customer tickets, kitchen orders, and cash cuts through CUPS.

## What it provides

- `POST /api/print/ticket`
- `POST /api/print/kitchen`
- `POST /api/print/cash-cut`
- `GET /api/jobs`
- `POST /api/jobs/:id/retry`
- `GET /api/queues`
- `GET /health`

It stores jobs in `print-gateway/data/jobs.json` and retries failed jobs automatically.

## 1) Prepare environment

1. Copy env file:
   `cp print-gateway/.env.example print-gateway/.env`
2. Update values in `print-gateway/.env`:
   - `PRINT_GATEWAY_TOKEN`
   - `CUPS_QUEUE_TICKET`
   - `CUPS_QUEUE_KITCHEN`
   - `CUPS_QUEUE_CASH_CUT`
   - `PRINT_RAW` (depends on printer/driver)

## 2) Run locally

`node print-gateway/server.mjs`

Default port: `3020`.

## 3) Install as service on Raspberry Pi

`bash print-gateway/install-raspberry.sh /home/tato/juliana-orderflow`

Then:

- `sudo systemctl status juliana-print-gateway --no-pager`
- `curl http://127.0.0.1:3020/health`

## 4) Test requests

Use header: `x-print-token: <PRINT_GATEWAY_TOKEN>`

### Ticket

```bash
curl -X POST http://127.0.0.1:3020/api/print/ticket \
  -H "Content-Type: application/json" \
  -H "x-print-token: change-me" \
  -d '{
    "orderNumber": 1234,
    "customerName": "Barra",
    "paymentMethodLabel": "Efectivo",
    "total": 245,
    "items": [
      { "quantity": 1, "subtotal": 110, "product": { "name": "Baguette Healthy" } },
      { "quantity": 1, "subtotal": 135, "product": { "name": "Clásica" }, "customLabel": "Sin cebolla" }
    ]
  }'
```

### Kitchen

```bash
curl -X POST http://127.0.0.1:3020/api/print/kitchen \
  -H "Content-Type: application/json" \
  -H "x-print-token: change-me" \
  -d '{
    "orderNumber": 1234,
    "customerName": "Barra",
    "items": [
      { "quantity": 1, "product": { "name": "Baguette Healthy" } },
      { "quantity": 1, "product": { "name": "Clásica" }, "customLabel": "Sin cebolla" }
    ]
  }'
```

### Cash Cut

```bash
curl -X POST http://127.0.0.1:3020/api/print/cash-cut \
  -H "Content-Type: application/json" \
  -H "x-print-token: change-me" \
  -d '{
    "title": "CORTE DE CAJA (HOY)",
    "generatedAt": "26/02/2026 21:10",
    "salesCount": 18,
    "expectedCash": 2450,
    "countedCash": 2450,
    "difference": 0,
    "entries": [
      { "label": "Billete 500", "value": 500, "quantity": 2 },
      { "label": "Billete 200", "value": 200, "quantity": 3 }
    ]
  }'
```

## 5) Operational notes

- If printing fails, job is marked `failed` and retried.
- Successful print marks the job as `printed`.
- `GET /api/jobs` lets you audit status and retry specific jobs.
