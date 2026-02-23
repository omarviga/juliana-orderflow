// Simple Express server example (run with: node express-server.js)
const express = require('express');
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('Hello from Express'));
app.post('/webhook', (req, res) => {
  // handle webhook body
  console.log('webhook', req.body);
  res.status(200).send('ok');
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Express listening on', port));
