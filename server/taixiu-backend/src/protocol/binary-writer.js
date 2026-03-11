"use strict";

class BinaryWriter {
  constructor() {
    this.bytes = [];
  }

  writeByte(value) {
    this.bytes.push(Number(value) & 0xff);
    return this;
  }

  writeBool(value) {
    this.writeByte(value ? 1 : 0);
    return this;
  }

  writeBytes(values) {
    const source = Buffer.isBuffer(values) ? values : Buffer.from(values || []);
    for (const value of source) {
      this.writeByte(value);
    }
    return this;
  }

  writeShort(value) {
    this.writeByte((value >> 8) & 0xff);
    this.writeByte(value & 0xff);
    return this;
  }

  writeUnsignedShort(value) {
    return this.writeShort(value);
  }

  writeInt(value) {
    this.writeByte((value >> 24) & 0xff);
    this.writeByte((value >> 16) & 0xff);
    this.writeByte((value >> 8) & 0xff);
    this.writeByte(value & 0xff);
    return this;
  }

  writeLong(value) {
    const TWO_POW_64 = 1n << 64n;
    let v = BigInt(value ?? 0);
    if (v < 0n) {
      v = TWO_POW_64 + v;
    }
    for (let i = 7; i >= 0; i -= 1) {
      const byte = Number((v >> BigInt(i * 8)) & 0xffn);
      this.writeByte(byte);
    }
    return this;
  }

  writeString(text) {
    const bytes = Buffer.from(String(text ?? ""), "utf8");
    this.writeUnsignedShort(bytes.length);
    this.writeBytes(bytes);
    return this;
  }

  toBuffer() {
    return Buffer.from(this.bytes);
  }
}

module.exports = BinaryWriter;

