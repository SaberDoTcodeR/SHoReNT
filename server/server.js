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


    const httpsServer = https.createServer(serverConfig);
    httpsServer.listen(HTTPS_PORT, '0.0.0.0');

// ----------------------------------------------------------------------------------------

// Create a server for handling websocket calls

    const wss = new WebSocketServer({server: httpsServer});
    var clients = {};
    var connections = {};
    wss.on('connection', function (ws) {
        var UUID = createUUID();
        clients[UUID] = ws;
        ws.send(JSON.stringify({"msg_id": 'assign_UUID', "uuid": UUID}));
        console.log(UUID)
        ws.on('message', function (message) {
            var signal = JSON.parse(message);
            console.log(signal);


            switch (signal.msg_id) {
                case 'ice_candidate':
                case 'sdp':
                    if (!wss.send_offer(signal, message)) {
                        ws.send(JSON.stringify({"msg_id": 'error', "error": "Couldn't find anyone with given UUID"}));
                        return;
                    }
                    return;
                case 'disconnect_from_peer':
                    var client2 = clients[signal.dest_uuid];
                    delete connections[signal.uuid];
                    delete connections[signal.dest_uuid];
                    client2.send(JSON.stringify({
                        "msg_id": 'disconnect_from_peer',
                        'uuid': signal.dest_uuid,
                        'dest_uuid': signal.uuid
                    }));
                    return;
                case 'refuse_p2p_connection_request':
                    wss.send_offer(signal, JSON.stringify({
                        "msg_id": 'error',
                        "error": "Sorry, but your mate refused you, find some one else"
                    }));
                    return;
                case 'save_connection_in_hashtable':
                    var client = clients[signal.uuid];
                    var client2 = clients[signal.dest_uuid];
                    connections[signal.uuid] = client2;
                    connections[signal.dest_uuid] = client;
                    return;
                case 'p2p_connection_request':
                    client2 = clients[signal.dest_uuid];
                    if (client2) {
                        if (connections[signal.dest_uuid]) {
                            ws.send(JSON.stringify({
                                "msg_id": 'error',
                                "error": "Sorry, but your mate is Busy right now."
                            }));
                        } else {
                            client2.send(JSON.stringify({
                                "msg_id": 'p2p_connection_request',
                                "uuid": signal.uuid,
                                "dest_uuid": signal.dest_uuid
                            }));
                        }
                    }
                    return;
                case 'accept_connection':
                    var client2 = clients[signal.dest_uuid];
                    if (client2) {
                        if (!connections[signal.dest_uuid]) {
                            client2.send(JSON.stringify({
                                "msg_id": 'accept_connection',
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