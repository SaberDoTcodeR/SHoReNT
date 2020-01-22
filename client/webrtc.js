var localVideo;
var localStream;
var remoteVideo;
var peerConnection;
var uuid;
var serverConnection;


var channel;

var peerConnectionConfig = {
    'iceServers': [
        {'urls': 'stun:194.225.46.142:3478'}//should be updated

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
    uuid = createUUID();

    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');

    serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');
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
    peerConnection.addStream(localStream);
    openDataChannel();
    peerConnection.ondatachannel = receiveChannelCallback;


    if (isCaller) {
        peerConnection.createOffer().then(createdDescription).catch(errorHandler);
    }

}

function gotMessageFromServer(message) {
    if (!peerConnection) start(false);

    var signal = JSON.parse(message.data);

    // Ignore messages from ourself
    if (signal.uuid == uuid) return;

    if (signal.sdp) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function () {
            // Only create answers in response to offers
            if (signal.sdp.type == 'offer') {
                peerConnection.createAnswer().then(createdDescription).catch(errorHandler);
            }
        }).catch(errorHandler);
    } else if (signal.ice) {
        peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
    }
}

function gotIceCandidate(event) {
    if (event.candidate != null) {
        serverConnection.send(JSON.stringify({'ice': event.candidate, 'uuid': uuid}));
    }
}

function createdDescription(description) {
    console.log('got description');

    peerConnection.setLocalDescription(description).then(function () {
        serverConnection.send(JSON.stringify({'sdp': peerConnection.localDescription, 'uuid': uuid}));
    }).catch(errorHandler);
}

function gotRemoteStream(event) {
    console.log('got remote stream');
    remoteVideo.srcObject = event.streams[0];
}

function errorHandler(error) {
    console.log(error);
}

// Taken from http://stackoverflow.com/a/105074/515584
// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
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