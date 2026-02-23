/**
 * Servidor Express simple para servir endpoints de Bluetooth Print
 * 
 * Uso:
 * 1. Instala dependencias: npm install express cors
 * 2. Ejecuta: node printer-server.js
 * 3. Abre: http://localhost:3001/
 * 
 * Desde Juliana POS, usa: my.bluetoothprint.scheme://http://localhost:3001/api/print/ticket
 */

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Tipos para el datos de impresora
/**
 * @typedef {Object} PrinterData
 * @property {0|1|2|3|4} type - 0=text, 1=image, 2=barcode, 3=QR, 4=HTML
 * @property {string} [content]
 * @property {0|1} [bold]
 * @property {0|1|2} [align]
 * @property {0|1|2|3|4} [format]
 * @property {string} [path]
 * @property {string} [value]
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [size]
 */

// Función helper para crear entrada de texto
function createTextEntry(
  content,
  bold = 0,
  align = 1,
  format = 0
) {
  return {
    type: 0,
    content,
    bold,
    align,
    format,
  };
}

// Endpoint de prueba
app.get("/", (req, res) => {
  res.json({
    message: "Servidor de Bluetooth Print funcionando",
    endpoints: {
      test: "GET /api/print/test",
      ticket: "POST /api/print/ticket",
      kitchen: "POST /api/print/kitchen",
    },
  });
});

// Endpoint de prueba simple
app.get("/api/print/test", (req, res) => {
  const data = [
    createTextEntry(" "),
    createTextEntry("PRUEBA", 1, 1, 3),
    createTextEntry("Servidor funcionando", 0, 1, 0),
    createTextEntry("=".repeat(32), 0, 0, 0),
    createTextEntry("Este es un test de impresión", 0, 1, 0),
    createTextEntry("=".repeat(32), 0, 0, 0),
  ];

  res.json(data);
});

// Endpoint para ticket de cliente
app.post("/api/print/ticket", (req, res) => {
  const {
    items = [],
    total = 0,
    orderNumber = null,
    customerName = "Cliente",
    businessName = "JULIANA",
    businessSubtitle = "BARRA COTIDIANA",
    businessAddress = "Av. Miguel Hidalgo #276",
    businessPhone = "Tel: 417 206 0111",
  } = req.body;

  const data = [];

  // Space
  data.push(createTextEntry(" "));

  // Header
  data.push(createTextEntry(businessName, 1, 1, 3));
  data.push(createTextEntry(businessSubtitle, 0, 1, 0));
  data.push(createTextEntry(businessAddress, 0, 1, 0));
  data.push(createTextEntry(businessPhone, 0, 1, 0));

  // Separador
  data.push(createTextEntry("=".repeat(42), 0, 0, 0));

  // Orden info
  data.push(createTextEntry(`Pedido: #${orderNumber || "---"}`, 1, 0, 0));
  data.push(createTextEntry(`Nombre: ${customerName}`, 1, 0, 0));

  const dateStr = new Date().toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
  data.push(createTextEntry(dateStr, 0, 0, 0));

  // Separador
  data.push(createTextEntry("=".repeat(42), 0, 0, 0));

  // Items
  items.forEach((item) => {
    const itemLine = `${item.quantity}x ${item.product?.name || "Items"}${
      item.productSize ? ` (${item.productSize.name})` : ""
    }`;
    const priceLine = `$${(item.subtotal || 0).toFixed(0)}`;

    data.push({
      type: 4,
      content: `<div style="display: flex; justify-content: space-between;"><span>${itemLine}</span><span style="text-align: right;">${priceLine}</span></div>`,
    });

    if (item.customLabel) {
      data.push(createTextEntry(`  • ${item.customLabel}`, 0, 0, 4));
    }
  });

  // Separador
  data.push(createTextEntry("=".repeat(42), 0, 0, 0));

  // Total
  data.push(createTextEntry(`TOTAL: $${total.toFixed(0)}`, 1, 1, 3));

  // Separador
  data.push(createTextEntry("=".repeat(42), 0, 0, 0));

  // Footer
  data.push(createTextEntry("¡Gracias por tu visita!", 0, 1, 0));
  data.push(createTextEntry("Vuelve pronto", 0, 1, 0));
  data.push(createTextEntry(" ", 0, 1, 0));

  res.json(data);
});

// Endpoint para comanda de cocina
app.post("/api/print/kitchen", (req, res) => {
  const {
    items = [],
    orderNumber = null,
    customerName = "Cliente",
  } = req.body;

  const data = [];

  // Space
  data.push(createTextEntry(" "));

  // Header
  data.push(createTextEntry("COMANDA", 1, 1, 3));
  data.push(createTextEntry(`#${orderNumber || "---"}`, 1, 1, 1));

  // Separador
  data.push(createTextEntry("=".repeat(32), 0, 0, 0));

  // Cliente y hora
  data.push(createTextEntry(`👤 ${customerName}`, 1, 0, 0));

  const dateStr = new Date().toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
  data.push(createTextEntry(`🕐 ${dateStr}`, 0, 0, 0));

  // Separador
  data.push(createTextEntry("=".repeat(32), 0, 0, 0));

  // Items
  items.forEach((item) => {
    const itemLine = `${item.quantity}x ${(item.product?.name || "Item").toUpperCase()}`;
    data.push(createTextEntry(itemLine, 1, 0, 0));

    if (item.productSize) {
      data.push(
        createTextEntry(`  Tamaño: ${item.productSize.name}`, 0, 0, 0)
      );
    }

    if (item.customLabel) {
      data.push(createTextEntry(`  • ${item.customLabel}`, 0, 0, 0));
    }
  });

  // Separador
  data.push(createTextEntry("=".repeat(32), 0, 0, 0));

  // Acción
  data.push(createTextEntry("PREPARAR AHORA", 1, 1, 3));

  data.push(createTextEntry(" "));

  res.json(data);
});

app.listen(PORT, () => {
  console.log(`📱 Servidor de Bluetooth Print escuchando en puerto ${PORT}`);
  console.log(`http://localhost:${PORT}`);
  console.log(`\nEndpoints disponibles:`);
  console.log(`- http://localhost:${PORT}/api/print/test`);
  console.log(`- POST http://localhost:${PORT}/api/print/ticket`);
  console.log(`- POST http://localhost:${PORT}/api/print/kitchen`);
});
