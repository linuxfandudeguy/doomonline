// scriptprocessernodeshim.mjs
// Auto-applying polyfill for ScriptProcessorNode using AudioWorkletNode (ESM)
// https://github.com/linuxfandudeguy/shim-audiocontext-scriptprocessernode ==== MIT
/*!
audiocontext-polyfill.js v0.1.1
(c) 2013 - 2014 Shinnosuke Watanabe
Licensed under the MIT license
*/

class AudioBufferWrapper {
  constructor(channels, length, sampleRate, channelData) {
    this._channels = channels;
    this._length = length;
    this.sampleRate = sampleRate;
    this._channelData = channelData; // array of Float32Arrays
  }

  get numberOfChannels() {
    return this._channels;
  }

  get length() {
    return this._length;
  }

  getChannelData(c) {
    return this._channelData[c];
  }

  get duration() {
    return this._length / this.sampleRate;
  }
}

class AudioProcessingEvent {
  constructor(input, output, sampleRate, playbackTime) {
    this.playbackTime = playbackTime;
    this.inputBuffer = new AudioBufferWrapper(
      input.length,
      input[0]?.length || 0,
      sampleRate,
      input
    );
    this.outputBuffer = new AudioBufferWrapper(
      output.length,
      output[0]?.length || 0,
      sampleRate,
      output
    );
  }
}

async function applyScriptProcessorPolyfill() {
  if (!window.AudioContext) return;

  const ctxProto = window.AudioContext.prototype;

  if (ctxProto.createScriptProcessor) return; // Already supported

  console.warn(
    "[ScriptProcessorNode polyfill] Using AudioWorklet emulation. " +
      "Expect additional latency of ~bufferSize/sampleRate seconds."
  );

  // Worklet processor code
  const processorCode = class ScriptProcessorWorklet extends AudioWorkletProcessor {
    constructor() {
      super();
      this.bufferSize = 1024;
      this.numInputs = 1;
      this.numOutputs = 1;
      this.pendingInputs = [];
      this.pendingOutputs = [];

      this.port.onmessage = (e) => {
        if (e.data.type === "init") {
          this.bufferSize = e.data.bufferSize || 1024;
          this.numInputs = e.data.numInputs || 1;
          this.numOutputs = e.data.numOutputs || 1;
        } else if (e.data.type === "processed") {
          this.pendingOutputs.push(e.data.output);
        }
      };
    }

    process(inputs, outputs) {
      const frameCount = 128;
      const input = [];

      for (let i = 0; i < this.numInputs; i++) {
        const inChs = inputs[i] || [];
        input.push(inChs.map((ch) => new Float32Array(ch)));
      }

      this.pendingInputs.push(input);

      if (this.pendingInputs.length * frameCount >= this.bufferSize) {
        const blockIn = [];
        for (let c = 0; c < this.numInputs; c++) {
          const buf = new Float32Array(this.bufferSize);
          for (let i = 0; i < this.pendingInputs.length; i++) {
            buf.set(
              this.pendingInputs[i][c] || new Float32Array(frameCount),
              i * frameCount
            );
          }
          blockIn.push(buf);
        }

        const blockOut = [];
        for (let c = 0; c < this.numOutputs; c++) {
          blockOut.push(new Float32Array(this.bufferSize));
        }

        this.port.postMessage({
          type: "audioprocess",
          input: blockIn,
          output: blockOut,
          playbackTime: currentTime + this.bufferSize / sampleRate,
        });

        this.pendingInputs = [];
      }

      const outChs = outputs[0] || [];
      if (this.pendingOutputs.length > 0) {
        const block = this.pendingOutputs.shift();
        for (let c = 0; c < outChs.length; c++) {
          outChs[c].set(block[c].subarray(0, outChs[c].length));
        }
      } else {
        for (let c = 0; c < outChs.length; c++) outChs[c].fill(0);
      }

      return true;
    }
  };

  registerProcessor("script-processor-polyfill", ScriptProcessorWorklet);

  // Load into AudioWorklet
  const blob = new Blob([processorCode], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  const dummyCtx = new AudioContext();

  try {
    await dummyCtx.audioWorklet.addModule(url);
  } catch (err) {
    console.error("Failed to load polyfill AudioWorklet:", err);
    return;
  }

  dummyCtx.close();

  // Attach polyfilled createScriptProcessor
  ctxProto.createScriptProcessor = function (bufferSize, numInputChannels, numOutputChannels) {
    const node = new AudioWorkletNode(this, "script-processor-polyfill", {
      numberOfInputs: numInputChannels ? 1 : 0,
      numberOfOutputs: numOutputChannels ? 1 : 0,
      outputChannelCount: [numOutputChannels || 1],
    });

    node.bufferSize = bufferSize || 1024;
    node.onaudioprocess = null;

    node.port.postMessage({
      type: "init",
      bufferSize: node.bufferSize,
      numInputs: numInputChannels || 1,
      numOutputs: numOutputChannels || 1,
    });

    node.port.onmessage = (event) => {
      if (event.data.type === "audioprocess" && node.onaudioprocess) {
        const ev = new AudioProcessingEvent(
          event.data.input,
          event.data.output,
          this.sampleRate,
          event.data.playbackTime || this.currentTime
        );

        node.onaudioprocess(ev);

        const out = [];
        for (let c = 0; c < ev.outputBuffer.numberOfChannels; c++) {
          out[c] = new Float32Array(ev.outputBuffer.getChannelData(c));
        }

        node.port.postMessage({ type: "processed", output: out });
      }
    };

    return node;
  };
}

// Auto-apply polyfill on import
applyScriptProcessorPolyfill();

export default applyScriptProcessorPolyfill;
