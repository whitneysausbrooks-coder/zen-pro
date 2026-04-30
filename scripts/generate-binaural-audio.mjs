#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(
  __dirname,
  "..",
  "artifacts",
  "neuro-quest-mobile",
  "assets",
  "audio"
);

const SAMPLE_RATE = 22050;
const DURATION_SEC = 10;
const N = SAMPLE_RATE * DURATION_SEC;

const PRESETS = [
  { id: "alpha_flow",         baseFreq: 200, beatFreq: 10, kind: "binaural" },
  { id: "deep_focus",         baseFreq: 250, beatFreq: 18, kind: "binaural" },
  { id: "theta_meditation",   baseFreq: 180, beatFreq:  6, kind: "binaural" },
  { id: "gamma_cognition",    baseFreq: 220, beatFreq: 40, kind: "binaural" },
  { id: "solfeggio_528",      baseFreq: 528, kind: "tone" },
  { id: "solfeggio_432",      baseFreq: 432, kind: "tone" },
  { id: "solfeggio_396",      baseFreq: 396, kind: "tone" },
  { id: "brown_noise",        kind: "brown" },
  { id: "pink_noise",         kind: "pink" },
];

function writeWav(filename, channels, samplesPerChannel) {
  const numChannels = channels.length;
  const bytesPerSample = 2;
  const dataSize = samplesPerChannel * numChannels * bytesPerSample;
  const fileSize = 36 + dataSize;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(fileSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * numChannels * bytesPerSample, 28);
  header.writeUInt16LE(numChannels * bytesPerSample, 32);
  header.writeUInt16LE(8 * bytesPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  const data = Buffer.alloc(dataSize);
  for (let i = 0; i < samplesPerChannel; i++) {
    for (let c = 0; c < numChannels; c++) {
      const v = channels[c][i];
      const clipped = Math.max(-1, Math.min(1, v));
      const int16 = Math.round(clipped * 32760);
      data.writeInt16LE(int16, (i * numChannels + c) * bytesPerSample);
    }
  }

  fs.writeFileSync(filename, Buffer.concat([header, data]));
}

function genTone(freq, amplitude = 0.45) {
  const out = new Float32Array(N);
  const omega = 2 * Math.PI * freq / SAMPLE_RATE;
  for (let i = 0; i < N; i++) out[i] = Math.sin(omega * i) * amplitude;
  return out;
}

function genBrown() {
  const out = new Float32Array(N);
  let last = 0;
  for (let i = 0; i < N; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    out[i] = last * 3.5 * 0.4;
  }
  applyLoopCrossfade(out, 1024);
  return out;
}

function genPink() {
  const out = new Float32Array(N);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < N; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11 * 0.6;
    b6 = w * 0.115926;
  }
  applyLoopCrossfade(out, 1024);
  return out;
}

function applyLoopCrossfade(buf, fadeSamples) {
  for (let i = 0; i < fadeSamples; i++) {
    const a = i / fadeSamples;
    const head = buf[i];
    const tail = buf[N - fadeSamples + i];
    const blended = head * a + tail * (1 - a);
    buf[i] = blended;
    buf[N - fadeSamples + i] = blended;
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const p of PRESETS) {
  const out = path.join(OUT_DIR, `${p.id}.wav`);
  if (p.kind === "binaural") {
    const left = genTone(p.baseFreq);
    const right = genTone(p.baseFreq + p.beatFreq);
    writeWav(out, [left, right], N);
  } else if (p.kind === "tone") {
    const mono = genTone(p.baseFreq);
    writeWav(out, [mono], N);
  } else if (p.kind === "brown") {
    const mono = genBrown();
    writeWav(out, [mono], N);
  } else if (p.kind === "pink") {
    const mono = genPink();
    writeWav(out, [mono], N);
  }
  const stat = fs.statSync(out);
  console.log(`  ${p.id.padEnd(20)} ${(stat.size / 1024).toFixed(0).padStart(4)} KB  ${out}`);
}

console.log(`\nGenerated ${PRESETS.length} loops -> ${OUT_DIR}`);
