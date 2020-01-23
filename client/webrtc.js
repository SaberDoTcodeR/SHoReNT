var localVideo;
var localStream;
var remoteVideo;
var peerConnection;
var uuid;
var serverConnection;
var dest_UUID

var channel;

var peerConnectionConfig = {
    'iceServers': [
        {'urls': 'stun:194.225.47.253:3478'}//should be updated

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

async function pageReady() {


    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');

    serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');
    serverConnection.onmessage = gotMessageFromServer;

    var constraints = {
        video: true,
        audio: true,
    };

    if (navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia(constraints).then(getUserMediaSuccess).catch(errorHandler);

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


    openDataChannel();
    peerConnection.ondatachannel = receiveChannelCallback;


    if (isCaller) {
        dest_UUID = prompt("dest UUID", "UUID");
        peerConnection.createOffer().then(createdDescription).catch(errorHandler);
        peerConnection.addStream(localStream);

    }


}

function gotMessageFromServer(message) {
    if (!peerConnection) start(false);

    var signal = JSON.parse(message.data);
    console.log(signal)
    if ("error" in signal) {
        alert(signal.error);
        return;
    }
    if ("cancel" in signal) {
        if (signal.cancel) {
            alert("heyy");
            cancel();
            return;
        }
    }
    if ("given_uuid" in signal) {
        uuid = signal.given_uuid;
        console.log(uuid)
        return;
    }

    // Ignore messages from ourself
    if (signal.uuid == uuid) return;

    if (signal.sdp) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function () {
            // Only create answers in response to offers
            if (signal.sdp.type == 'offer') {
                if (confirm('You have an offer from ' + signal.uuid + ' ,do you want to start p2p connetion?')) {
                    dest_UUID = signal.uuid;
                    peerConnection.createAnswer().then(createdDescription).catch(errorHandler);
                    serverConnection.send(JSON.stringify({'cancel': false, 'uuid': uuid}));

                } else {
                    serverConnection.send(JSON.stringify({'uuid': uuid, 'dest_uuid': signal.uuid, 'refuse': true}));

                }
            }
        }).catch(errorHandler);
    } else if (signal.ice) {
        peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
        peerConnection.addStream(localStream);
    }
}

function gotIceCandidate(event) {
    if (event.candidate != null) {
        serverConnection.send(JSON.stringify({'ice': event.candidate, 'uuid': uuid, 'dest_uuid': dest_UUID}));
    }
}

function createdDescription(description) {

    peerConnection.setLocalDescription(description).then(function () {
        serverConnection.send(JSON.stringify({
            'sdp': peerConnection.localDescription,
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
        channel.send('RTCDataChannel opened.');
    };

    channel.onclose = function (event) {
        console.log('RTCDataChannel closed.');
    };

    channel.onerror = function (event) {
        console.error(event);
    };


}

function cancel() {
    serverConnection.send(JSON.stringify({'cancel': true, 'uuid': uuid, 'dest_uuid': dest_UUID}));
    peerConnection.close();
    dest_UUID = null
    messageInputBox.disabled = true;
    sendButton.disabled = true;
    channel.close();
}

window.addEventListener('load', startup, false);