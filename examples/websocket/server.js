// Simple WebSocket server using ws
// npm i ws
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 }, () => console.log('ws listening on 8080'));

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ message: 'welcome' }));
  ws.on('message', (msg) => {
    console.log('received', msg.toString());
    // echo
    ws.send(msg.toString());
  });
});
