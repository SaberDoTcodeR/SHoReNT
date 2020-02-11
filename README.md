SHoReNT
==============

#### Developed by Saber Zafarpoor

This project is especially developed for and tested on Sharif Network but we can insure it's scalability.

This Application is used to connect any two individual in Sharif Network to transfer file or have a video chat or just a simple chat.

This App uses a(or maybe more) signaling server/servers to reach somebody else in the network in p2p mode, so it means that any data(e.g. video or file or text) you sent to your peer will not pass through our servers and will be directly send to your peer.

No one in the network even the administrator of network or producers of this app dont have the ability to know who you are or who your peer is or what data you are sending.
 
Note: This repo is kept updated. The general ideas are there, but feel free to contact us and report any possible bugs.


## running server(only for those who want to help the network get faster and more reliable)

The signaling server uses Node.js and `ws` and can be started as such:

```
$ npm install
$ npm start
```
*We will inform you in future how this contribution will work* 
With the server running, open a recent version of Firefox, Chrome, or Safari and visit `https://localhost:8443`.

* Note the HTTPS! There is no redirect from HTTP to HTTPS.
* Some browsers or OSs may not allow the webcam to be used by multiple pages at once. You may need to use two different browsers or machines.

## Problems?

WebRTC is a rapidly evolving beast. We are trying to make our app works as smoothly as possible but any bug especially in UI can happen, we would greatly appreciate your feedback or bug report.

## License

The MIT License (MIT)

Copyright (c) 2020
