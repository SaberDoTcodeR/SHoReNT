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
        {'urls': 'stun:stun.l.google.com:19302'}//should be updated

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


    //localVideo = document.getElementById('localVideo');
    //remoteVideo = document.getElementById('remoteVideo');

    serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');
    serverConnection.onmessage = gotMessageFromServer;

    /*var constraints = {
        video: true,
        audio: true,
    };

    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia(constraints).then(getUserMediaSuccess).catch(errorHandler);
    } else {
        alert('Your browser does not support getUserMedia API');
    }*/
}

function getUserMediaSuccess(stream) {
    localStream = stream;
    localVideo.srcObject = stream;
}

function start(isCaller) {
    peerConnection = new RTCPeerConnection(peerConnectionConfig);
    peerConnection.onicecandidate = gotIceCandidate;

    //peerConnection.ontrack = gotRemoteStream;
    // peerConnection.addStream(localStream);
    openDataChannel();
    peerConnection.ondatachannel = receiveChannelCallback;


    if (isCaller) {
        dest_UUID=prompt("dest UUID","UUID");
        peerConnection.createOffer().then(createdDescription).catch(errorHandler);
    }

}

function gotMessageFromServer(message) {
    if (!peerConnection) start(false);

    var signal = JSON.parse(message.data);

    // Ignore messages from ourself
    if ("given_uuid" in signal){
        uuid=signal.given_uuid;
        return;
    }
    if (signal.uuid == uuid) return;

    if (signal.sdp) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function () {
            // Only create answers in response to offers
            if (signal.sdp.type == 'offer') {
                dest_UUID=signal.uuid;
                peerConnection.createAnswer().then(createdDescription).catch(errorHandler);
            }
        }).catch(errorHandler);
    } else if (signal.ice) {
        peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
    }
}

function gotIceCandidate(event) {
    if (event.candidate != null) {
        serverConnection.send(JSON.stringify({'ice': event.candidate, 'uuid': uuid,'dest_uuid': dest_UUID}));
    }
}

function createdDescription(description) {
    console.log(uuid);
    console.log(dest_UUID);
    peerConnection.setLocalDescription(description).then(function () {
        serverConnection.send(JSON.stringify({'sdp': peerConnection.localDescription, 'uuid': uuid ,'dest_uuid': dest_UUID}));
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

window.addEventListener('load', startup, false);