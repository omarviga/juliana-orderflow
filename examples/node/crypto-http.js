// Node built-in http + crypto example (run with: node crypto-http.js)
const http = require('http');
const crypto = require('crypto');

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    const nonce = crypto.randomBytes(16).toString('hex');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'hello', nonce }));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(4000, () => console.log('listening on http://localhost:4000'));
