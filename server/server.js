const HTTPS_PORT = 8443;

const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
try {
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
    var clients = {};

    wss.on('connection', function (ws) {
        let UUID = createUUID();
        clients[UUID] = [ws, true];//second field is for availability
        ws.send(JSON.stringify({"given_uuid": UUID}));
        console.log(UUID)
        ws.on('message', function (message) {
            var signal = JSON.parse(message);
            console.log(signal)
            if ("dest_uuid" in signal) {
                // send offer to specific client
                if ("refuse" in signal) {
                    wss.send_offer(signal, JSON.stringify({"error": "Sorry, but your mate refused you, find some one else"}))
                } else if ("cancel" in signal) {
                    if (signal.cancel) {
                        let client = clients[signal.uuid][0];
                        let client2 = clients[signal.dest_uuid][0];
                        clients[signal.uuid] = [client, true]
                        clients[signal.dest_uuid] = [client2, true]
                        client2.send(JSON.stringify({
                            'cancel': true,
                            'uuid': signal.dest_uuid,
                            'dest_uuid': signal.uuid
                        }));

                    } else {
                        let client = clients[signal.uuid][0];
                        clients[signal.uuid] = [client, false]
                    }
                } else {
                    if (!wss.send_offer(signal, message)) {
                        ws.send(JSON.stringify({"error": "Couldn't find anyone with given UUID"}));
                    }
                }
            }
        });
    });

    wss.send_offer = function (data, message) {
        if (clients.hasOwnProperty(data.dest_uuid)) {
            let client = clients[data.dest_uuid][0];
            if (client.readyState === WebSocket.OPEN && clients[data.dest_uuid][1]) {
                console.log(data.dest_uuid)
                client.send(message);
            }
            return true;
        } else {
            return false;
        }
    };
} catch (e) {
}

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