#!/bin/bash

# Get Sándwiches category order
SANDWICH_ORDER=$(curl -s "https://vexsdilhoejvvaxysmvu.supabase.co/rest/v1/categories?name=eq.Sándwiches" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleHNkaWxob2VqdnZheHlzbXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDQ3NTEsImV4cCI6MjA4NzMyMDc1MX0._5coi2C10OrwjJsOcpwt38OR7iYJic8pJg-3zb5mW7U" | jq ".[0].display_order")

BAGUETTE_ORDER=$((SANDWICH_ORDER + 1))

# Insert Baguettes category
BAGUETTES_RESPONSE=$(curl -s -X POST "https://vexsdilhoejvvaxysmvu.supabase.co/rest/v1/categories" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleHNkaWxob2VqdnZheHlzbXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDQ3NTEsImV4cCI6MjA4NzMyMDc1MX0._5coi2C10OrwjJsOcpwt38OR7iYJic8pJg-3zb5mW7U" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Baguettes\", \"display_order\": $BAGUETTE_ORDER}")

BAGUETTES_ID=$(echo $BAGUETTES_RESPONSE | jq -r ".[0].id")

if [ "$BAGUETTES_ID" == "null" ] || [ -z "$BAGUETTES_ID" ]; then
  echo "Error creating Baguettes category:"
  echo $BAGUETTES_RESPONSE
  exit 1
fi

echo "✓ Baguettes category created: $BAGUETTES_ID"

# Insert products
curl -s -X POST "https://vexsdilhoejvvaxysmvu.supabase.co/rest/v1/products" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleHNkaWxob2VqdnZheHlzbXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDQ3NTEsImV4cCI6MjA4NzMyMDc1MX0._5coi2C10OrwjJsOcpwt38OR7iYJic8pJg-3zb5mW7U" \
  -H "Content-Type: application/json" \
  -d "[
    {\"category_id\": \"$BAGUETTES_ID\", \"name\": \"Baguette Pavo y Panela\", \"price\": 85.00, \"is_customizable\": false, \"display_order\": 1},
    {\"category_id\": \"$BAGUETTES_ID\", \"name\": \"Baguette Serrano y Queso\", \"price\": 110.00, \"is_customizable\": false, \"display_order\": 2},
    {\"category_id\": \"$BAGUETTES_ID\", \"name\": \"Baguette Healthy\", \"price\": 75.00, \"is_customizable\": false, \"display_order\": 3},
    {\"category_id\": \"$BAGUETTES_ID\", \"name\": \"Baguette Roast Beef\", \"price\": 110.00, \"is_customizable\": false, \"display_order\": 4},
    {\"category_id\": \"$BAGUETTES_ID\", \"name\": \"Baguette Garlic Grill Cheese\", \"price\": 75.00, \"is_customizable\": false, \"display_order\": 5}
  ]" > /tmp/response.json

PRODUCT_COUNT=$(jq 'length' /tmp/response.json 2>/dev/null || echo 0)
echo "✓ Products created: $PRODUCT_COUNT"

if [ $PRODUCT_COUNT -gt 0 ]; then
  jq '.[] | "  - \(.name) ($\(.price))"' /tmp/response.json
fi

echo ""
echo "✓ Migration completed successfully!"
