"use strict";

const BinaryWriter = require("./binary-writer");
const BinaryReader = require("./binary-reader");

const BIT_IS_BINARY_INDEX = 7;
const BIT_IS_ENCRYPT_INDEX = 6;
const BIT_IS_COMPRESS_INDEX = 5;
const BIT_IS_BLUE_BOXED_INDEX = 4;
const BIT_IS_BIG_SIZE_INDEX = 3;

function getBit(value, bitIndex) {
  return (value & (1 << bitIndex)) !== 0;
}

function setBit(value, bitIndex, enabled) {
  return enabled ? value | (1 << bitIndex) : value & ~(1 << bitIndex);
}

function genHeader(isBigSize = false, isCompress = false) {
  let header = 0;
  header = setBit(header, BIT_IS_BINARY_INDEX, true);
  header = setBit(header, BIT_IS_ENCRYPT_INDEX, false);
  header = setBit(header, BIT_IS_COMPRESS_INDEX, isCompress);
  header = setBit(header, BIT_IS_BLUE_BOXED_INDEX, true);
  header = setBit(header, BIT_IS_BIG_SIZE_INDEX, isBigSize);
  return header;
}

function bufferFromAny(data) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  throw new Error("Unsupported binary data type.");
}

function stripPacketHeader(rawBuffer) {
  if (rawBuffer.length < 4) return rawBuffer;
  const header = rawBuffer[0];
  const looksFramed = getBit(header, BIT_IS_BINARY_INDEX) && getBit(header, BIT_IS_BLUE_BOXED_INDEX);
  if (!looksFramed) return rawBuffer;

  const isBigSize = getBit(header, BIT_IS_BIG_SIZE_INDEX);
  const headerSize = isBigSize ? 5 : 3;
  if (rawBuffer.length < headerSize) return rawBuffer;
  const size = isBigSize ? rawBuffer.readUInt32BE(1) : rawBuffer.readUInt16BE(1);
  const end = headerSize + size;
  if (rawBuffer.length < end) {
    return rawBuffer.subarray(headerSize);
  }
  return rawBuffer.subarray(headerSize, end);
}

function parseClientPacket(data) {
  const raw = bufferFromAny(data);
  const body = stripPacketHeader(raw);
  const reader = new BinaryReader(body);
  const controllerId = reader.readByte();
  const cmdId = reader.readShort();
  const payload = reader.readBytes(reader.remaining());
  return { raw, body, controllerId, cmdId, payload };
}

function buildServerPacket({ controllerId = 1, cmdId, error = 0, payload = Buffer.alloc(0), framed = false }) {
  const writer = new BinaryWriter();
  writer.writeByte(controllerId & 0xff);
  writer.writeShort(cmdId);
  writer.writeByte(error & 0xff);
  writer.writeBytes(payload);
  const body = writer.toBuffer();
  if (!framed) return body;

  const isBigSize = body.length > 0xffff;
  const headerSize = isBigSize ? 5 : 3;
  const packet = Buffer.alloc(headerSize + body.length);
  packet.writeUInt8(genHeader(isBigSize, false), 0);
  if (isBigSize) {
    packet.writeUInt32BE(body.length, 1);
  } else {
    packet.writeUInt16BE(body.length, 1);
  }
  body.copy(packet, headerSize);
  return packet;
}

module.exports = {
  parseClientPacket,
  buildServerPacket,
  bufferFromAny
};

