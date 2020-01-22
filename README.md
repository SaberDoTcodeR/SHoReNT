SHoReNT
==============

#### Developed by Saber Zafarpoor

This project is especially developed for Sharif Network.

This Application is used to connect any two individual in Sharif Network to transfer file or have a video chat.

Note: This repo is kept updated. The general ideas are there, but feel free to contact us and report any possible bugs.


## Usage

The signaling server uses Node.js and `ws` and can be started as such:

```
$ npm install
$ npm start
```

With the server running, open a recent version of Firefox, Chrome, or Safari and visit `https://localhost:8443`.

* Note the HTTPS! There is no redirect from HTTP to HTTPS.
* Some browsers or OSs may not allow the webcam to be used by multiple pages at once. You may need to use two different browsers or machines.

## TLS

Recent versions of Chrome require secure websockets for WebRTC. Thus, this example utilizes HTTPS. Included is a self-signed certificate that must be accepted in the browser for the example to work.

## Problems?

WebRTC is a rapidly evolving beast. We are trying to make our app works as smoothly as possible.

## License

The MIT License (MIT)

Copyright (c) 2020
