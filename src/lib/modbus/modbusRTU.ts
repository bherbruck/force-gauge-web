export class ModbusRTUService {
  private port: SerialPort;
  private reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  private writer: WritableStreamDefaultWriter<Uint8Array> | undefined;

  constructor(port: SerialPort) {
    this.port = port;
  }

  async connect(): Promise<void> {
    await this.port.open({ baudRate: 9600 });
    if (!this.port.writable || !this.port.readable) {
      throw new Error("Writable stream not available");
    }

    this.reader = this.port.readable.getReader();
    this.writer = this.port.writable.getWriter();
  }

  async disconnect(): Promise<void> {
    if (!this.reader || !this.writer) return;
    await this.reader.cancel();
    await this.writer.close();
    this.reader.releaseLock();
    this.writer.releaseLock();
    await this.port.close();
  }

  isConnected(): boolean {
    return (
      this.port.readable &&
      this.port.writable &&
      !this.port?.readable.locked &&
      !this.port?.writable.locked
    );
  }

  async readHoldingRegisters(
    slaveId: number,
    address: number,
    quantity: number
  ): Promise<Uint8Array> {
    if (!this.writer) throw new Error("Writable stream not available");
    const requestFrame = this.buildReadHoldingRegistersRequest(
      slaveId,
      address,
      quantity
    );
    await this.writer.write(requestFrame);
    // Calculate expected response length: 1 (slave ID) + 1 (function code) + 1 (byte count) + 2*quantity (data bytes) + 2 (CRC)
    const expectedResponseLength = 5 + 2 * quantity;
    return (await this.readResponse(expectedResponseLength)).slice(3, -2);
  }

  async writeRegister(
    slaveId: number,
    address: number,
    value: number
  ): Promise<void> {
    const requestFrame = this.buildWriteRegisterRequest(
      slaveId,
      address,
      value
    );
    if (!this.writer) throw new Error("Writable stream not available");
    await this.writer.write(requestFrame);
    // Expected response length for write register: 1 (slave ID) + 1 (function code) + 2 (address) + 2 (value) + 2 (CRC)
    const expectedResponseLength = 8;
    await this.readResponse(expectedResponseLength); // Assuming response validation is handled internally
  }

  private buildReadHoldingRegistersRequest(
    slaveId: number,
    address: number,
    quantity: number
  ): Uint8Array {
    const functionCode = 0x03; // Function code for reading holding registers
    const buffer = new ArrayBuffer(8);
    const frame = new DataView(buffer);
    frame.setUint8(0, slaveId);
    frame.setUint8(1, functionCode);
    frame.setUint16(2, address);
    frame.setUint16(4, quantity);
    const crc = this.calculateCRC(new Uint8Array(buffer.slice(0, 6)));
    frame.setUint16(6, crc, true); // CRC (little-endian)
    return new Uint8Array(buffer);
  }

  private buildWriteRegisterRequest(
    slaveId: number,
    address: number,
    value: number
  ): Uint8Array {
    const functionCode = 0x06; // Function code for writing a single register
    const buffer = new ArrayBuffer(8);
    const frame = new DataView(buffer);
    frame.setUint8(0, slaveId);
    frame.setUint8(1, functionCode);
    frame.setUint16(2, address);
    frame.setUint16(4, value);
    const crc = this.calculateCRC(new Uint8Array(buffer.slice(0, 6)));
    frame.setUint16(6, crc, true); // CRC (little-endian)
    return new Uint8Array(buffer);
  }

  private async readResponse(expectedLength: number): Promise<Uint8Array> {
    if (!this.reader) throw new Error("Readable stream not available");
    const buffer = new Uint8Array(expectedLength);
    let bytesRead = 0;
    while (bytesRead < expectedLength) {
      const { value, done } = await this.reader.read();
      if (done) {
        throw new Error("Stream closed prematurely");
      }
      buffer.set(new Uint8Array(value), bytesRead);
      bytesRead += value.byteLength;
    }
    return buffer;
  }

  private calculateCRC(data: Uint8Array): number {
    let crc = 0xffff;
    for (let pos = 0; pos < data.length; pos++) {
      crc ^= data[pos];
      for (let i = 8; i !== 0; i--) {
        if ((crc & 0x0001) !== 0) {
          crc >>= 1;
          crc ^= 0xa001;
        } else {
          crc >>= 1;
        }
      }
    }
    return crc;
  }
}
