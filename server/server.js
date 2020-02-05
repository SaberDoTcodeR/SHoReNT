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
    var connections = {};
    wss.on('connection', function (ws) {
        var UUID = createUUID();
        clients[UUID] = ws;
        ws.send(JSON.stringify({"msg_id": 1, "uuid": UUID}));
        console.log(UUID)
        ws.on('message', function (message) {
            var signal = JSON.parse(message);
            console.log(signal);


            switch (signal.msg_id) {
                case 2:
                case 4:
                    if (!wss.send_offer(signal, message)) {
                        ws.send(JSON.stringify({"msg_id": 3, "error": "Couldn't find anyone with given UUID"}));
                        return;
                    }
                    return;
                case 5:
                    var client2 = clients[signal.dest_uuid];
                    delete connections[signal.uuid];
                    delete connections[signal.dest_uuid];
                    client2.send(JSON.stringify({
                        "msg_id": 5,
                        'uuid': signal.dest_uuid,
                        'dest_uuid': signal.uuid
                    }));
                    return;
                case 6:
                    wss.send_offer(signal, JSON.stringify({
                        "msg_id": 3,
                        "error": "Sorry, but your mate refused you, find some one else"
                    }));
                    return;
                case 7:
                    var client = clients[signal.uuid];
                    var client2 = clients[signal.dest_uuid];
                    connections[signal.uuid] = client2;
                    connections[signal.dest_uuid] = client;
                    return;
                case 8:
                    client2 = clients[signal.dest_uuid];
                    if (client2) {
                        if (connections[signal.dest_uuid]) {
                            ws.send(JSON.stringify({
                                "msg_id": 3,
                                "error": "Sorry, but your mate is Busy right now."
                            }));
                        } else {
                            client2.send(JSON.stringify({
                                "msg_id": 8,
                                "uuid": signal.uuid,
                                "dest_uuid": signal.dest_uuid
                            }));
                        }
                    }
                    return;
                case 9:
                    var client2 = clients[signal.dest_uuid];
                    if (client2) {
                        if (!connections[signal.dest_uuid]) {
                            client2.send(JSON.stringify({
                                "msg_id": 9,
                                "uuid": signal.dest_uuid,
                                "dest_uuid": signal.uuid
                            }));
                        }
                    }
                    return;
                default:
                    console.log("why the fucK", signal);

            }

        });
        ws.on('error', function (err) {
            console.log('error!');
            return;
        });
    });


    wss.send_offer = function (data, message) {
        if (clients.hasOwnProperty(data.dest_uuid)) {
            var client = clients[data.dest_uuid];

            if (client.readyState === WebSocket.OPEN && !connections[data.dest_uuid]) {
                console.log(data.dest_uuid);
                client.send(message);
                return true;
            }
            return false;
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