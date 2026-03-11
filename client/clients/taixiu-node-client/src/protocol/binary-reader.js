class BinaryReader {
  constructor(input) {
    if (Buffer.isBuffer(input)) {
      this.buffer = input;
    } else if (input instanceof Uint8Array) {
      this.buffer = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
    } else if (input instanceof ArrayBuffer) {
      this.buffer = Buffer.from(input);
    } else {
      throw new Error("BinaryReader expects Buffer, Uint8Array, or ArrayBuffer.");
    }
    this.offset = 0;
  }

  remaining() {
    return this.buffer.length - this.offset;
  }

  readByte() {
    this.ensure(1);
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readBool() {
    return this.readByte() > 0;
  }

  readBytes(length) {
    this.ensure(length);
    const out = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return out;
  }

  readShort() {
    this.ensure(2);
    const value = this.buffer.readInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  readUnsignedShort() {
    this.ensure(2);
    const value = this.buffer.readUInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  readInt() {
    this.ensure(4);
    const value = this.buffer.readInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  readLong() {
    this.ensure(8);
    let value = 0n;
    for (let i = 0; i < 8; i += 1) {
      value = (value << 8n) | BigInt(this.buffer[this.offset + i]);
    }
    this.offset += 8;
    if (value & (1n << 63n)) {
      value -= 1n << 64n;
    }
    return value;
  }

  readString() {
    const len = this.readUnsignedShort();
    const bytes = this.readBytes(len);
    return Buffer.from(bytes).toString("utf8");
  }

  ensure(required) {
    if (this.offset + required > this.buffer.length) {
      throw new Error(
        `Buffer underflow. Need ${required} bytes, only ${this.remaining()} left.`
      );
    }
  }
}

module.exports = BinaryReader;
