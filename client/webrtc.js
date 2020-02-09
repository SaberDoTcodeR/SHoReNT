var localVideo;
var localStream;
var remoteVideo;
var peerConnection;
var serverConnection;
var chatChannel;
var fileChannel;
let websocket_ip = '192.168.196.56';
let uuid;
let dest_UUID;
let symmetric_password;
let bool_video_chat;
var before_uuid;
var before_dest_uuid;

let fileDownload = null;

let sendFileDom = {};
let recFileDom = {};
let receiveBuffer = [];
let receivedSize = 0;
let theFile;


var peerConnectionConfig = {
    'iceServers': [
        {'urls': 'stun:' + websocket_ip + ':3478'}//should be updated

    ]
};

function startup() {

    sendButton = document.getElementById('sendButton');
    messageInputBox = document.getElementById('message');
    receiveBox = document.getElementById('receivebox');
    videoCheck = document.getElementById('video');
    fileTransfer = document.getElementById('fileTransfer');
    // Set event listeners for user interface widgets
    fileDownload = document.getElementById('fileDownload');
    messageInputBox.disabled = true;
    sendButton.disabled = true;
    sendButton.addEventListener('click', sendMessage, false);
}

function sendMessage() {

    var message = messageInputBox.value;

    chatChannel.send(message);
    console.log(message);
    // Clear the input box and re-focus it, so that we're
    // ready for the next message.

    messageInputBox.value = "";
    messageInputBox.focus();
}


function uploadFile() {
    const files = fileTransfer.files;
    if (files.length > 0) {
        theFile = files[0];
        sendFileDom.name = theFile.name;
        sendFileDom.size = theFile.size;
        sendFileDom.type = theFile.type;
        sendFileDom.fileInfo = "areYouReady";
        console.log(sendFileDom);
    } else {
        console.log('No file selected');
    }
}

function sendFile() {
    if (!fileTransfer.value) return;
    const fileInfo = JSON.stringify(sendFileDom);
    fileChannel.send(fileInfo);
    console.log('file sent');
}

function fileChannelHandler() {
    fileChannel.onopen = function (event) {
        console.log('file channel is open', event);
    }

    fileChannel.onmessage = function (event) {
        // Figure out data type
        const type = Object.prototype.toString.call(event.data);
        console.log(event.data);
        let data;

        if (type == "[object ArrayBuffer]") {
            data = event.data;
            receiveBuffer.push(data);
            console.log(data.byteLength);
            receivedSize += Math.round(data.byteLength);
            recFileProg.value = receivedSize;
            console.log(receivedSize, recFileDom.size);
            if (receivedSize === recFileDom.size) {
                const received = new window.Blob(receiveBuffer);
                fileDownload.href = URL.createObjectURL(received);
                fileDownload.innerHTML = "download";
                fileDownload.download = recFileDom.name;

                receiveBuffer = [];
                receivedSize = 0;
            }
        } else if (type == "[object String]") {
            data = JSON.parse(event.data);
        } else if (type == "[object Blob]") {
            console.log(event.data);
            receiveBuffer.push(event.data);
            console.log(event.data.size);
            receivedSize += event.data.size;
            recFileProg.value = receivedSize;
            console.log(receivedSize, recFileDom.size);
            if (receivedSize === recFileDom.size) {
                const received = new window.Blob(receiveBuffer);
                fileDownload.href = URL.createObjectURL(received);
                fileDownload.innerHTML = "download";
                fileDownload.download = recFileDom.name;

                receiveBuffer = [];
                receivedSize = 0;
            }

        }

        // Handle initial msg exchange
        if (data && data.fileInfo) {
            if (data.fileInfo == "areYouReady") {
                recFileDom = data;
                recFileProg.max = data.size;
                const sendData = JSON.stringify({fileInfo: "readyToReceive"});
                fileChannel.send(sendData);
            } else if (data.fileInfo == "readyToReceive") {
                sendFileProg.max = sendFileDom.size;
                sendFileInChannel(); // Start sending the file
            }
            console.log('fileChannel: ', data.fileInfo);
        }
    }

    fileChannel.onclose = function () {
        console.log('file channel closed');
    }

}

function sendFileInChannel() {
    const chunkSize = 16000;
    let sliceFile = function (offset) {
        let reader = new window.FileReader();
        reader.onload = (function () {
            return function (event) {
                fileChannel.send(event.target.result);
                console.log(event.target.result);
                if (theFile.size > offset + event.target.result.byteLength) {
                    window.setTimeout(sliceFile, 0, offset + chunkSize);
                }
                sendFileProg.value = offset + event.target.result.byteLength;
            };
        })(theFile);
        const slice = theFile.slice(offset, offset + chunkSize);
        reader.readAsArrayBuffer(slice);
    };
    sliceFile(0);
}

function receiveChannelCallback(e) {
    if (e.channel.label == "fileChannel") {
        console.log('fileChannel Received -', e);
        fileChannel = e.channel;
        fileChannelHandler();
    }
    if (e.channel.label == "chatChannel") {
        receiveChannel = e.channel;
        console.log('chatChannel Received -', e);
        receiveChannel.onmessage = handleReceiveMessage;
        receiveChannel.onopen = handleReceiveChannelStatusChange;
        receiveChannel.onclose = handleReceiveChannelStatusChange;
    }


}

// Handle onmessage events for the receiving channel.
// These are the data messages sent by the sending channel.
var arrayToStoreChunks = [];

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
        if (receiveChannel.readyState === 'closed') {
            dest_UUID = null;
            remoteVideo.srcObject = null;
            messageInputBox.disabled = true;
            sendButton.disabled = true;
        }
    }

}


function pageReady() {


    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');

    serverConnection = new WebSocket('wss://' + websocket_ip + ':8443');
    serverConnection.onmessage = gotMessageFromServer;

}

function getUserMediaSuccess(stream) {
    localStream = stream;
    localVideo.srcObject = stream;
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

}

function start(isCaller) {
    bool_video_chat = videoCheck.checked;
    peerConnection = new RTCPeerConnection(peerConnectionConfig);
    peerConnection.onicecandidate = gotIceCandidate;
    if (bool_video_chat) {
        try {
            var constraints = {
                video: true,
                audio: true,
            };
            if (navigator.mediaDevices.getUserMedia)
                navigator.mediaDevices.getUserMedia(constraints).then(getUserMediaSuccess).catch(errorHandler);
            else
                alert('Your browser does not support getUserMedia API');

        } catch (e) {
            alert('There is problem in accessing camera')
        }
    } else {

        localStream = null;
        localVideo.srcObject = null;
    }
    try {
        peerConnection.ontrack = gotRemoteStream;

    } catch (e) {
        alert('There is problem in accessing your peer\'s camera')
    }
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
            if (before_uuid) {
                serverConnection.send(JSON.stringify({
                    "msg_id": 'disconnect_from_peer',
                    'uuid': before_uuid,
                    'dest_uuid': before_dest_uuid
                }));
                before_uuid = null;
                before_dest_uuid = null;
            }
            return;
        case 'ice_candidate':
            if (peerConnection.remoteDescription) {
                peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
            }
            return;

        case 'error':
            alert(signal.error);
            return;
        case 'sdp':
            signal.sdp.sdp = CryptoJS.AES.decrypt(signal.sdp.sdp, symmetric_password).toString(CryptoJS.enc.Utf8);

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
                if (bool_video_chat)
                    peerConnection.addStream(localStream);
            }
            return;
        case 'accept_connection':
            peerConnection.createOffer().then(createdDescription).catch(errorHandler);
            if (bool_video_chat)
                peerConnection.addStream(localStream);
            return;
        default:


    }

}

function gotIceCandidate(event) {

    if (event.candidate != null) {
        serverConnection.send(JSON.stringify({
            "msg_id": 'ice_candidate',
            'ice': event.candidate,
            'uuid': uuid,
            'dest_uuid': dest_UUID
        }));
    }
}

function createdDescription(description) {

    peerConnection.setLocalDescription(description).then(function () {
        var x = peerConnection.localDescription;
        x.sdp = CryptoJS.AES.encrypt(x.sdp, symmetric_password).toString();

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
    fileChannel = peerConnection.createDataChannel('fileChannel');
    fileChannelHandler();
    chatChannel = peerConnection.createDataChannel('chatChannel',
        {
            reliable: true,
            maxPacketLifeTime: 3000
        }
    );

    chatChannel.onmessage = function (event) {
        console.log(event.data);
        var data = JSON.parse(event.data);

        arrayToStoreChunks.push(data.message); // pushing chunks in array

        if (data.last) {
            saveToDisk(arrayToStoreChunks.join(''), 'fake fileName');
            arrayToStoreChunks = []; // resetting array
        }
    };

    chatChannel.onopen = function (event) {
        messageInputBox.disabled = false;
        messageInputBox.focus();
        sendButton.disabled = false;
        serverConnection.close();
        chatChannel.send('RTCDataChannel opened.');
    };

    chatChannel.onclose = function (event) {
        console.log('RTCDataChannel closed.');
    };

    chatChannel.onerror = function (event) {
        console.error(event);
    };


}

function cancel(is_starter) {
    if (is_starter) {
        before_uuid = uuid;
        before_dest_uuid = dest_UUID;
        serverConnection = new WebSocket('wss://' + websocket_ip + ':8443');
    }
    dest_UUID = null;
    remoteVideo.srcObject = null;
    messageInputBox.disabled = true;
    sendButton.disabled = true;
    chatChannel.close();
}

window.addEventListener('load', startup, false);