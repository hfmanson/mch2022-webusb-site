/**
 * Created by Tom on 5/27/2020.
 */

 /* eslint-disable */

export let device = { opened: false };
let command;
let size = 0;
let received = 0;
let payload;
let messageid_recv;
let cb_reply_read = [];
let cb_reply_dir = [];
const packetheadersize = 12;

let current_message_id = 0;
let requests = {};
let stdout_callback;

let selected_mode = 0;
let active_mode = 0;

let capture;
let captureData = "";

let MAX_RETRIES = 3;

import * as $ from 'jquery';
import * as JSZip from 'jszip';


function sendHeartbeat() {
    let { buffer, message_id } = buildpacketWithFilename(0, 1, "beat");
    send_buffer(buffer, message_id, true).then(data => { console.debug("Heartbeat") }, reason => { console.log("Heartbeat no response") });
}

//Function to create valid packet. Size is the payload size, command is the command id
export function buildpacket(size, command) {
    //console.log(packetheadersize+size);
    current_message_id++;
    let arraybuffer = new ArrayBuffer(12 + size);
    let buffer = new Uint8Array(arraybuffer);
    new DataView(arraybuffer).setUint16(0, command, true);
    new DataView(arraybuffer).setUint32(2, size, true);
    new DataView(arraybuffer).setUint32(8, current_message_id, true);
    buffer[6] = 0xDE;
    buffer[7] = 0xAD;
    return { buffer: buffer, message_id: current_message_id };
}

export function buildpacketWithFilename(size, command, filename) {
    let { buffer, message_id } = buildpacket(filename.length + 1 + size, command, message_id);
    for (let i = 0; i < filename.length; i++) {
        buffer[packetheadersize + i] = filename.charCodeAt(i);
    }
    buffer[packetheadersize + filename.length] = 0;
    return { buffer, message_id: message_id };
}

function rewritemessageid(buffer) {
    if (buffer instanceof Uint8Array || buffer instanceof Uint16Array || buffer instanceof Uint32Array) {
        // If buffer is not an ArrayBuffer, get its ArrayBuffer property
        buffer = buffer.buffer;
    }
    console.log(buffer);
    current_message_id++;
    new DataView(buffer).setUint32(8, current_message_id, true);
    return current_message_id;
}

export function send_buffer(buffer, message_id, return_string = true) {
	let resolve, reject;
	let promise = new Promise((_resolve, _reject) => { resolve = _resolve; reject = _reject; });
	let request = {
		buffer, // For retransmit
		resolve: (data) => {
			if (return_string) {
				if (data.byteLength === 0) {
					resolve("");
					return true;
				} else {
					let textdecoder = new TextDecoder("ascii");
					resolve(textdecoder.decode(data));
					return true
				}
			} else {
				resolve(data);
				return true;
			}
		},
		reject: (reason, immediate_reject = false) => {
			if (!immediate_reject && request.retries <= MAX_RETRIES) {
				request.retries++;
				console.log(buffer);
				rewritemessageid(buffer);
				device.transferOut(5, buffer);
				return false;
			} else {
				reject(reason);
				return true;
			}
		},
		retries: 0 // Number of times this request has been retransmitted already
	};
	requests[message_id] = request;
	headerbuf = null;
	device.transferOut(5, buffer);
    if (selected_mode === 1) {
		return promise;
    } else {
		return resetEsp32ToWebUSB(4, 1).then(promise);
	}
}

export function fetch_dir(dir_name) {
    console.log('Fetching', dir_name);
    if (dir_name === undefined || dir_name === '') {
        dir_name = '/';
    }
/*
    let { buffer, message_id } = buildpacket(dir_name.length + 1, 4096);
    for (let i = 0; i < dir_name.length; i++) {
        buffer[packetheadersize + i] = dir_name.charCodeAt(i);
    }
    buffer[packetheadersize + dir_name.length] = 0;
    return send_buffer(buffer, message_id, true);
*/
	return doPython('import os,sys,json;\njson.dump("' + dir_name + '\\n" + "\\n".join(list(map(lambda tuple: ("d" if tuple[1] & 0x4000 else "f") + tuple[0], list(os.ilistdir("' + dir_name + '"))))), sys.stdout)');
}

export function readfile(file_name, return_string = true) {
/*
    let { buffer, message_id } = buildpacketWithFilename(0, 4097, file_name);
    return send_buffer(buffer, message_id, return_string).then((contents) => {
        if (contents === 'Can\'t open file') {
            contents = undefined;
        }
        return contents;
    });
*/
	const name = file_name.slice(1).split(".")[0].replaceAll("/", ".");
	return doPython('import os,sys,json;\nf = open("' + file_name + '");__name__=' + JSON.stringify(name) + ';__file__=' + JSON.stringify(file_name) + ';y = f.read();f.close();json.dump(y, sys.stdout)');
}

export function createfile(dir_name) {
    let { buffer, message_id } = buildpacketWithFilename(0, 4098, dir_name);
    return send_buffer(buffer, message_id);
}

export async function deldir(dir_name) {
    let dir = await fetch_dir(dir_name)
    let dirlist = dir.split('\n');
    dirlist.unshift();
    console.log(dirlist);
    for (let i = 1; i < dirlist.length; i++) {
        let item = dirlist[i];
        if (item.charAt(0) == 'd') {
            await deldir(dir_name + "/" + item.substr(1));
        } else {
            await delfile(dir_name + "/" + item.substr(1));
        }
    }
    await delfile(dir_name);
}

export async function downloaddir(dir_name, zip = undefined) {
    if (zip === undefined) {
        zip = new JSZip();
    }

    let dir = await fetch_dir(dir_name)
    let dirlist = dir.split('\n');
    dirlist.unshift();
    console.log(dirlist);
    for (let i = 1; i < dirlist.length; i++) {
        let item = dirlist[i];
        if (item.charAt(0) == 'd') {
            await downloaddir(dir_name + "/" + item.substr(1), zip.folder(item.substr(1)));
        } else {
            let data = await readfile(dir_name + "/" + item.substr(1));
            zip.file(item.substr(1), data);
        }
    }
    return zip;
}

export function delfile(dir_name) {
    console.log("Deleting: " + dir_name);
    let { buffer, message_id } = buildpacketWithFilename(0, 4099, dir_name);
    return send_buffer(buffer, message_id);
}

export function runfile(file_path) {
    if (file_path.startsWith('/flash')) {
        file_path = file_path.slice('/flash'.length);
    }
    let { buffer, message_id } = buildpacketWithFilename(0, 0, file_path);
    return send_buffer(buffer, message_id);
}

export async function appFSboot(file_path) {
    let { buffer, message_id } = buildpacketWithFilename(0, 3, file_path);
    return send_buffer(buffer, message_id)
		.then(() => {
			active_mode = undefined;
			setBaudrate(4, 115200)
			.then(() => {
				selected_mode = 0;
				active_mode = 0;
				console.log("active_mode: " + active_mode);
			})
			;
		}
	);
}

export function duplicatefile(source, destination) {
    let { buffer, message_id } = buildpacket(source.length + 1 + destination.length + 1, 4100);
    for (let i = 0; i < source.length; i++) {
        buffer[packetheadersize + i] = source.charCodeAt(i);
    }
    buffer[packetheadersize + source.length] = 0;

    for (let i = 0; i < destination.length; i++) {
        buffer[packetheadersize + source.length + 1 + i] = destination.charCodeAt(i);
    }
    buffer[packetheadersize + source.length + 1 + destination.length] = 0;
    //queue.enqueue(buffer);
    return send_buffer(buffer, message_id);
}

export function movefile(source, destination) {
    let { buffer, message_id } = buildpacket(source.length + 1 + destination.length + 1, 4101);
    for (let i = 0; i < source.length; i++) {
        buffer[packetheadersize + i] = source.charCodeAt(i);
    }
    buffer[packetheadersize + source.length] = 0;

    for (let i = 0; i < destination.length; i++) {
        buffer[packetheadersize + source.length + 1 + i] = destination.charCodeAt(i);
    }
    buffer[packetheadersize + source.length + 1 + destination.length] = 0;

    return send_buffer(buffer, message_id);
}

export function copyfile(source, destination) {
    let { buffer, message_id } = buildpacket(source.length + 1 + destination.length + 1, 4100);
    for (let i = 0; i < source.length; i++) {
        buffer[packetheadersize + i] = source.charCodeAt(i);
    }
    buffer[packetheadersize + source.length] = 0;

    for (let i = 0; i < destination.length; i++) {
        buffer[packetheadersize + source.length + 1 + i] = destination.charCodeAt(i);
    }
    buffer[packetheadersize + source.length + 1 + destination.length] = 0;

    return send_buffer(buffer, message_id);
}

export function savetextfile(filename, contents) {
    console.log(filename);
/*
    let { buffer, message_id } = buildpacketWithFilename(contents.length, 4098, filename);
    for (let i = 0; i < contents.length; i++) {
        buffer[packetheadersize + filename.length + 1 + i] = contents.charCodeAt(i);
    }

    return send_buffer(buffer, message_id);
*/
	return doPython('import json;f = open("' + filename + '","w");y=f.write(' + JSON.stringify(contents) + ');f.close();json.dump(y, sys.stdout)');
}

export function savefile(filename, contents) {
    let { buffer, message_id } = buildpacketWithFilename(contents.byteLength, 4098, filename);
    let uint8 = new Uint8Array(buffer);
    uint8.set(new Uint8Array(contents), packetheadersize + filename.length + 1);
    buffer = uint8.buffer;
    return send_buffer(buffer, message_id);
}

export function createfolder(folder) {
    let { buffer, message_id } = buildpacketWithFilename(0, 4102, folder);
    return send_buffer(buffer, message_id);
}

export function handlePacket(message_type, message_id, data) {
    let textdecoder = undefined;
    let file_contents = undefined;

    if (message_type === 3 && message_id === 0) {
        textdecoder = new TextDecoder("ascii");
        let consolelog = textdecoder.decode(data);
        console.log(consolelog);
        if (stdout_callback) {
            stdout_callback(consolelog);
        }
    }

    if (message_type === 1 && message_id === 0) {
        textdecoder = new TextDecoder("ascii");
        file_contents = textdecoder.decode(data);
        file_contents = file_contents.substring(0, 2);
        if (file_contents === "to") {
            for (let key in requests) {
                let request = requests[key];
                if (!request.reject('Timeout')) {
                    requests[current_message_id] = request;
                }
                delete requests[key];
            }
        } else if (file_contents === "te") {
            for (let key in requests) {
                let request = requests[key];
                if (!request.reject('Timeout')) {
                    requests[current_message_id] = request;
                }
                delete requests[key];
            }
        }
        return;
    }

    for (let key in requests) {
        let request = requests[key];
        if (key < message_id) {
            request.reject('No response');
            delete requests[key];
        } else if (key == message_id) {
            if (data.byteLength === 3) {
                let textdecoder = new TextDecoder("ascii");
                let text_content = textdecoder.decode(data.slice(0, 2));
                if (text_content === 'er') {
                    request.reject('Unspecified error', true);  //Immediate reject when proper error is received
                } else {
                    request.resolve(data, true);
                }
            } else {
                request.resolve(data);
            }
            delete requests[key];
        }
    }
    // if(message_id in requests) {
    //     let request = requests[message_id];
    //     if(data.byteLength === 3) {
    //         let textdecoder = new TextDecoder("ascii");
    //         let text_content = textdecoder.decode(data.slice(0, 2));
    //         if(text_content === 'er') {
    //             request.reject('Unspecified error', true);  //Immediate reject when proper error is received
    //         } else {
    //             request.resolve(data, true);
    //         }
    //     } else {
    //         request.resolve(data);
    //     }
    // }
}

export function registerstdout(func) {
    stdout_callback = func;
}


export function writetostdin(stdin) {
	const
		encoded = new TextEncoder().encode(stdin)
		;

	console.log("writetostdin: " + stdin);
	if (selected_mode !== 0) {
		return appFSboot("python").then(() => device.transferOut(5, encoded));
	} else {
		return device.transferOut(5, encoded);
	}
}

let headerbuf = null;

var _appendBuffer = function(buffer1, buffer2) {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
};

async function doPython(pythoncode) {
	const
		executor = (resolutionFunc, rejectionFunc) => {
			capture = function (data) {
				const parsed = JSON.parse(data);
				console.log(parsed);
				resolutionFunc(parsed);
			};
			captureData = "";
			writetostdin("\x01" + pythoncode + "\x04");
		}
		;
	return new Promise(executor);
}

window.doPython = doPython;

let readdata = () => {
    device.transferIn(5, 64).then(result => {
        //console.log("Received buffer")
        //console.log(result.data.buffer);
        switch (active_mode) {
            case 0: {
				const decoder = new TextDecoder();
				const message = decoder.decode(result.data);
				console.log(message);
				if (capture) {
					captureData += message;
					console.log(captureData);
					const result = /OK(.*)\x04(.*)\x04/s.exec(captureData);
					if (result) {
						capture(result[1]);
						capture = undefined;
					}
				} else {
					stdout_callback(message);
				}
                break;
            }
            case 1: {
                let buffer = result.data.buffer;
                if (headerbuf != null) {
                    buffer = _appendBuffer(headerbuf, buffer);
                }
                let parsedbytes = 0;
                let totalbytes = buffer.byteLength;
                //console.log("Complete buffer")
                //console.log(buffer);
                while (parsedbytes != totalbytes) {
                    if (received == size) { //Should read a new packet header
                        if ((totalbytes - parsedbytes) < 12) {
                            headerbuf = new Uint8Array(buffer, parsedbytes);
                            break; //Not full packet header
                        } else {
                            headerbuf = null;
                        }       
                        if (parsepacketheader(buffer.slice(parsedbytes, parsedbytes + 12))) {
                            payload = new ArrayBuffer(size);
                            console.log("Command: "+command+" Size: "+size+" id: "+messageid_recv);
                            if (size == 0) {
                                handlePacket(command, messageid_recv, payload);
                            }
                        } else {
                            console.log("Error in packet header");
                            received = 0;
                            size = 0;
                        }
                        parsedbytes += 12;
                    } else {
                        let sizetocopy = Math.min(size, totalbytes - parsedbytes, size - received);
                        new Uint8Array(payload, received, size - received).set(new Uint8Array(buffer, parsedbytes, sizetocopy));
                        parsedbytes += sizetocopy;
                        received += sizetocopy;
                        //console.log("Transfer status: "+received+"/"+size);
                        if (received == size) {
                            handlePacket(command, messageid_recv, payload);
                        }
                    }
                }
                break;
            }
            default:
                //console.log("no active mode");
                break;
        }
        readdata();
    }, error => {
        this.onReceiveError(error);
    });
};

function parsepacketheader(data) {
    let view = new DataView(data);
    command = view.getUint16(0, true);
    size = view.getUint32(2, true);
    let verif = view.getUint16(6);
    messageid_recv = view.getUint32(8, true);
    received = 0;
    return verif == 57005;
}

let connect_resolves = [];
function connect_check() {
    if (device !== undefined && device.opened) {
        for (let resolve of connect_resolves) {
            resolve();
        }
        connect_resolves = [];
    }
}
/*
setInterval(connect_check, 500);
setInterval(function () {
    if (device.opened) {
        if (Object.keys(requests).length < 5)
            sendHeartbeat();
    }
}, 500);
*/


export function on_connect() {
    return new Promise((resolve) => connect_resolves.push(resolve));
}

async function readserial() {
    let res = await device.controlTransferIn({
        requestType: 'class',
        recipient: 'interface',
        request: 0x23,
        value: 0x02,
        index: 0x02
    }, 16);

    let textdecoder = new TextDecoder("ascii");
    let text_content = textdecoder.decode(res.data.buffer);
    let raw = new Uint8Array(res.data.buffer);
    let valid = 0;
    for (let i = 0; i < 16; i++) {
        if (raw[i] == 0) {
            valid = i;
            break;
        }
    }
    text_content = text_content.substr(0, valid);
    if (text_content.length) {
        console.log(text_content);
    }
}

function sendControl(ifIndex, request, value) {
    return device.controlTransferOut(
        {
            requestType: 'class',
            recipient: 'interface',
            request: request,
            value: value,
            index: ifIndex
        }
    ).then(result => {
        console.log(result);
    });
}

function sendState(ifIndex, state) {
    return sendControl(ifIndex, 0x22, state);
}

function resetEsp32(ifIndex, bootloader_mode = false) {
    return sendControl(ifIndex, 0x23, bootloader_mode ? 0x01 : 0x00);
}

function setBaudrate(ifIndex, baudrate) {
    console.log("Baudrate for " + ifIndex + " set to " + baudrate);
    return sendControl(ifIndex, 0x24, Math.floor(baudrate / 100));
}

function setMode(ifIndex, mode) {
	active_mode = undefined;
    console.log("active_mode undefined");
    selected_mode = mode;
    return sendControl(ifIndex, 0x25, mode)
		.then(() => { active_mode = mode; });
}

function resetEsp32ToWebUSB(ifIndex, webusb_mode) {
    return setMode(ifIndex, webusb_mode)
	.then(() => resetEsp32(ifIndex))
	.then(() => {
		if (webusb_mode > 0) {
			setBaudrate(ifIndex, 921600)				;
		} else {
			setBaudrate(ifIndex, 115200);
		}
	})
	.then(() => {
		setTimeout(() => {
			active_mode = webusb_mode;
			console.log("active_mode: " + active_mode);
		}, 2000);
	})
	;
}


export function connect() {
    command = 0;
    size = 0;
    received = 0;
    payload = 0;
    messageid_recv = 0;
    current_message_id = 1;
    requests = {};
    let ifIndex = 4

    return navigator.usb.requestDevice({ filters: [{ vendorId: 0x16d0 }] })
        .then(selectedDevice => {
            device = selectedDevice;
            window.dev = selectedDevice;
            return device.open(); // Begin a session.
        })
        .then(() => device.selectConfiguration(1)) // Select configuration #1 for the device.
        .then(() => device.claimInterface(ifIndex)) // Request exclusive control over interface #2.
        .then(() => sendState(ifIndex, 1))
//        .then(() => resetEsp32ToWebUSB(ifIndex, 1))
//		.then(() => appFSboot("python"))
		.then(() => setMode(ifIndex, 0))
		.then(() => setBaudrate(ifIndex, 115200))
        .then(() => readdata());
}
