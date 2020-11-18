"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Input = void 0;
const stream_1 = require("stream");
class Input extends stream_1.Writable {
    constructor(args) {
        super(args);
        this.args = args;
        this.buffer = Buffer.alloc(0);
        if (args.channels !== 1 && args.channels !== 2) {
            args.channels = 2;
        }
        if (args.sampleRate < 1) {
            args.sampleRate = 44100;
        }
        if (args.volume < 0 || args.volume > 100) {
            args.volume = 100;
        }
        if (args.channels === 1) {
            this.readMono = this.read;
        }
        if (args.channels === 2) {
            this.readStereo = this.read;
        }
        if (args.bitDepth === 8) {
            this.readSample = this.buffer.readInt8;
            this.writeSample = this.buffer.writeInt8;
            this.sampleByteLength = 1;
        }
        else if (args.bitDepth === 32) {
            this.readSample = this.buffer.readInt32LE;
            this.writeSample = this.buffer.writeInt32LE;
            this.sampleByteLength = 4;
        }
        else {
            args.bitDepth = 16;
            this.readSample = this.buffer.readInt16LE;
            this.writeSample = this.buffer.writeInt16LE;
            this.sampleByteLength = 2;
        }
        this.hasData = false;
        this.lastClearTime = new Date().getTime();
    }
    setMixer(mixer) {
        this.mixer = mixer;
    }
    read(samples) {
        let bytes = samples * (this.args.bitDepth / 8) * this.args.channels;
        if (this.buffer.length < bytes) {
            bytes = this.buffer.length;
        }
        const sample = this.buffer.slice(0, bytes);
        this.buffer = this.buffer.slice(bytes);
        for (let i = 0; i < sample.length; i += 2) {
            sample.writeInt16LE(Math.floor((this.args.volume * sample.readInt16LE(i)) / 100), i);
        }
        return sample;
    }
    readMono(samples) {
        const stereoBuffer = this.read(samples);
        const monoBuffer = Buffer.alloc(stereoBuffer.length / 2);
        const availableSamples = this.availableSamples(stereoBuffer.length);
        for (let i = 0; i < availableSamples; i++) {
            const l = this.readSample.call(stereoBuffer, i * this.sampleByteLength * 2);
            const r = this.readSample.call(stereoBuffer, i * this.sampleByteLength * 2 + this.sampleByteLength);
            this.writeSample.call(monoBuffer, Math.floor((l + r) / 2), i * this.sampleByteLength);
        }
        return monoBuffer;
    }
    readStereo(samples) {
        const monoBuffer = this.read(samples);
        const stereoBuffer = Buffer.alloc(monoBuffer.length * 2);
        const availableSamples = this.availableSamples(monoBuffer.length);
        for (let i = 0; i < availableSamples; i++) {
            const m = this.readSample.call(monoBuffer, i * this.sampleByteLength);
            this.writeSample.call(stereoBuffer, m, i * this.sampleByteLength * 2);
            this.writeSample.call(stereoBuffer, m, i * this.sampleByteLength * 2 + this.sampleByteLength);
        }
        return stereoBuffer;
    }
    availableSamples(length) {
        length = length || this.buffer.length;
        return Math.floor(length / ((this.args.bitDepth / 8) * this.args.channels));
    }
    _write(chunk, encoding, next) {
        if (!this.hasData) {
            this.hasData = true;
        }
        this.buffer = Buffer.concat([this.buffer, chunk]);
        if (this.buffer.length > this.args.maxBuffer) {
            this.buffer = chunk;
        }
        next();
    }
    setVolume(volume) {
        this.args.volume = Math.max(Math.min(volume, 100), 0);
    }
    getVolume() {
        return this.args.volume;
    }
    clear(force) {
        const now = new Date().getTime();
        if (force ||
            (this.args.clearInterval &&
                now - this.lastClearTime >= this.args.clearInterval)) {
            let length = 1024 * (this.args.bitDepth / 8) * this.args.channels;
            this.buffer = this.buffer.slice(0, length);
            this.lastClearTime = now;
        }
    }
    destroy() {
        this.buffer = Buffer.alloc(0);
    }
}
exports.Input = Input;
