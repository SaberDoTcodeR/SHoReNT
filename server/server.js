const HTTPS_PORT = 8443;

const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;

// Yes, TLS is required
const serverConfig = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem'),
};

// ----------------------------------------------------------------------------------------

// Create a server for the client html page
const handleRequest = function (request, response) {
    // Render the single client html file for any request the HTTP server receives
    console.log('request received: ' + request.url);

    if (request.url === '/') {
        response.writeHead(200, {'Content-Type': 'text/html'});
        response.end(fs.readFileSync('client/index.html'));
    } else if (request.url === '/webrtc.js') {
        response.writeHead(200, {'Content-Type': 'application/javascript'});
        response.end(fs.readFileSync('client/webrtc.js'));
    }
};

const httpsServer = https.createServer(serverConfig, handleRequest);
httpsServer.listen(HTTPS_PORT, '0.0.0.0');

// ----------------------------------------------------------------------------------------

// Create a server for handling websocket calls
const wss = new WebSocketServer({server: httpsServer});
var clients={};
wss.on('connection', function (ws) {
    var UUID=createUUID();
    clients[UUID]=ws;
    console.log(UUID);
    ws.send(JSON.stringify({"given_uuid": UUID}));
    ws.on('message', function (message) {
        var signal = JSON.parse(message);
        console.log('received: %s', signal);
        if ("dest_uuid" in signal){
            // send offer to specefic client
            wss.send_offer(signal,message);
        }


    });
});

wss.send_offer = function (data,message) {
    if (clients.hasOwnProperty(data.dest_uuid)){
        client=clients[data.dest_uuid];
        if (client.readyState === WebSocket.OPEN ) {
            console.log(data.dest_uuid)
            client.send(message);
        }
        return;
    }
};

console.log('Server running. Visit https://localhost:' + HTTPS_PORT + ' in Firefox/Chrome.\n\n\
Some important notes:\n\
  * Note the HTTPS; there is no HTTP -> HTTPS redirect.\n\
  * You\'ll also need to accept the invalid TLS certificate.\n\
  * Some browsers or OSs may not allow the webcam to be used by multiple pages at once. You may need to use two different browsers or machines.\n'
);


// Taken from http://stackoverflow.com/a/105074/515584
// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}