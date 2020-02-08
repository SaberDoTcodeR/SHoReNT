var localVideo;
var localStream;
var remoteVideo;
var peerConnection;
var serverConnection;
var channel;
let websocket_ip = 'localhost';
let uuid;
let dest_UUID;
let symmetric_password;

var peerConnectionConfig = {
    'iceServers': [
        {'urls': 'stun:' + websocket_ip}//should be updated

    ]
};

function startup() {

    sendButton = document.getElementById('sendButton');
    messageInputBox = document.getElementById('message');
    receiveBox = document.getElementById('receivebox');

    // Set event listeners for user interface widgets

    sendButton.addEventListener('click', sendMessage, false);
}

function sendMessage() {

    var message = messageInputBox.value;

    channel.send(message);
    console.log(message);
    // Clear the input box and re-focus it, so that we're
    // ready for the next message.

    messageInputBox.value = "";
    messageInputBox.focus();
}

function receiveChannelCallback(event) {
    receiveChannel = event.channel;
    receiveChannel.onmessage = handleReceiveMessage;
    receiveChannel.onopen = handleReceiveChannelStatusChange;
    receiveChannel.onclose = handleReceiveChannelStatusChange;
}

// Handle onmessage events for the receiving channel.
// These are the data messages sent by the sending channel.

function handleReceiveMessage(event) {
    var el = document.createElement("p");
    var txtNode = document.createTextNode(event.data);

    el.appendChild(txtNode);
    receiveBox.appendChild(el);
}

function handleReceiveChannelStatusChange(event) {
    if (receiveChannel) {
        console.log("Receive channel's status has changed to " +
            receiveChannel.readyState);
    }

    // Here you would do stuff that needs to be done
    // when the channel's status changes.
}

function pageReady() {


    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');

    serverConnection = new WebSocket('wss://' + websocket_ip + ':8443');
    serverConnection.onmessage = gotMessageFromServer;

    var constraints = {
        video: true,
        audio: true,
    };

    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia(constraints).then(getUserMediaSuccess).catch(errorHandler);

    } else {
        alert('Your browser does not support getUserMedia API');
    }
}

function getUserMediaSuccess(stream) {
    localStream = stream;
    localVideo.srcObject = stream;

}

function start(isCaller) {
    peerConnection = new RTCPeerConnection(peerConnectionConfig);
    peerConnection.onicecandidate = gotIceCandidate;

    peerConnection.ontrack = gotRemoteStream;
    if (serverConnection.readyState === WebSocket.CLOSED) {
        serverConnection = new WebSocket('wss://' + websocket_ip + ':8443');
        serverConnection.onmessage = gotMessageFromServer;
    }

    openDataChannel();
    peerConnection.ondatachannel = receiveChannelCallback;


    if (isCaller) {
        dest_UUID = prompt("dest UUID", "UUID");
        symmetric_password = prompt("Your password to encrypt SDP and ICE ", "pass");
        serverConnection.send(JSON.stringify({
            "msg_id": 'p2p_connection_request',
            'uuid': uuid,
            'dest_uuid': dest_UUID
        }));
    }


}

function gotMessageFromServer(message) {
    if (!peerConnection) start(false);
    var signal = JSON.parse(message.data);


    console.log(signal);
    switch (signal.msg_id) {
        case 'assign_UUID':
            uuid = signal.uuid;
            console.log(uuid);
            return;
        case 'ice_candidate':
            if (peerConnection.remoteDescription) {
                console.log(signal.ice);
                signal.ice.candidate = CryptoJS.AES.decrypt(signal.ice.candidate, symmetric_password).toString(CryptoJS.enc.Utf8);
                console.log(signal.ice);
                peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
            }
            return;

        case 'error':
            alert(signal.error);
            return;
        case 'sdp':
            signal.sdp.sdp = CryptoJS.AES.decrypt(signal.sdp.sdp, symmetric_password).toString(CryptoJS.enc.Utf8);
            console.log(signal.sdp);
            peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function () {
                if (signal.sdp.type === 'offer') {
                    dest_UUID = signal.uuid;
                    peerConnection.createAnswer().then(createdDescription).catch(errorHandler);
                    serverConnection.send(JSON.stringify({"msg_id": 'save_connection_in_hashtable', 'uuid': uuid}));
                }

            }).catch(errorHandler);
            return;

        case 'disconnect_from_peer':
            alert("Disconnected from peer");
            cancel(false);
            return;
        case 'p2p_connection_request':
            if (!confirm('You have an offer from ' + signal.dest_uuid + ' ,do you want to start p2p connection?')) {
                serverConnection.send(JSON.stringify({
                    "msg_id": 'refuse_p2p_connection_request',
                    'uuid': uuid,
                    'dest_uuid': signal.uuid
                }));
            } else {
                start(false);
                dest_UUID = signal.uuid
                symmetric_password = prompt("Your password to encrypt SDP and ICE ", "pass");
                serverConnection.send(JSON.stringify({
                    "msg_id": 'accept_connection',
                    'uuid': uuid,
                    'dest_uuid': dest_UUID
                }));
                peerConnection.addStream(localStream);
            }
            return;
        case 'accept_connection':
            peerConnection.createOffer().then(createdDescription).catch(errorHandler);
            peerConnection.addStream(localStream);
            return;
        default:


    }

}

function gotIceCandidate(event) {

    if (event.candidate != null) {
        var x = event.candidate;
        x.candidate = CryptoJS.AES.encrypt(x.candidate, symmetric_password).toString();
        serverConnection.send(JSON.stringify({
            "msg_id": 'ice_candidate',
            'ice': x,
            'uuid': uuid,
            'dest_uuid': dest_UUID
        }));
    }
}

function createdDescription(description) {

    peerConnection.setLocalDescription(description).then(function () {
        var x = peerConnection.localDescription;
        x.sdp = CryptoJS.AES.encrypt(peerConnection.localDescription.sdp, symmetric_password).toString();

        serverConnection.send(JSON.stringify({
            "msg_id": 'sdp',
            'sdp': x,
            'uuid': uuid,
            'dest_uuid': dest_UUID
        }));
    }).catch(errorHandler);
}

function gotRemoteStream(event) {
    console.log('got remote stream');
    remoteVideo.srcObject = event.streams[0];
}

function errorHandler(error) {
    console.log(error);
}


function openDataChannel() {


    channel = peerConnection.createDataChannel('RTCDataChannel',
        {
            reliable: false
        }
    );

    channel.onmessage = function (event) {
        console.log(event.data);
    };

    channel.onopen = function (event) {
        messageInputBox.disabled = false;
        messageInputBox.focus();
        sendButton.disabled = false;
        serverConnection.close();
        channel.send('RTCDataChannel opened.');
    };

    channel.onclose = function (event) {
        console.log('RTCDataChannel closed.');
    };

    channel.onerror = function (event) {
        console.error(event);
    };


}

function cancel(is_starter) {
    if (is_starter)
        serverConnection.send(JSON.stringify({"msg_id": 'disconnect_from_peer', 'uuid': uuid, 'dest_uuid': dest_UUID}));
    dest_UUID = null;
    remoteVideo.srcObject = null;
    messageInputBox.disabled = true;
    sendButton.disabled = true;
    channel.close();
}

window.addEventListener('load', startup, false);