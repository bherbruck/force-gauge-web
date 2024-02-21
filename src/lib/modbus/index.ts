export const decodeModbusResponse = (buffer: Uint8Array) => {
  // Check CRC (example, assuming you have a function to calculate it)
  const receivedCrc = buffer.slice(-2); // Last two bytes
  const crcForCheck = calculateCRC(buffer.slice(0, -2));
  const isValidCrc =
    receivedCrc[0] === (crcForCheck & 0xff) &&
    receivedCrc[1] === crcForCheck >> 8;

  if (!isValidCrc) {
    console.error("CRC check failed");
    return;
  }

  const deviceAddress = buffer[0];
  const functionCode = buffer[1];
  const byteCount = buffer[2]; // Only for certain function codes

  // Assuming function code 0x03 and reading two registers
  // if (functionCode === 0x03) {
  const registerValues = new Uint16Array(buffer.buffer, 3, byteCount / 2); // Create a view starting at the 4th byte

  // Assuming Big-Endian byte order for Modbus RTU
  const value1 = registerValues[0];
  const value2 = registerValues[1];

  return { deviceAddress, functionCode, value1, value2 };
  // } else {
  //   console.log("Unexpected function code or response format");
  // }
};

export const calculateCRC = (buffer: Uint8Array) => {
  let crc = 0xffff; // Initial value
  for (let pos = 0; pos < buffer.length; pos++) {
    crc ^= buffer[pos]; // XOR byte into least sig. byte of crc

    for (let i = 8; i !== 0; i--) {
      // Loop over each bit
      if ((crc & 0x0001) !== 0) {
        // If the LSB is set
        crc >>= 1; // Shift right and XOR 0xA001
        crc ^= 0xa001;
      } else {
        // Else LSB is not set
        crc >>= 1; // Just shift right
      }
    }
  }
  // Note: crc is 16 bits, but JavaScript bitwise operations implicitly
  // convert operands to 32-bit integers. We use & 0xFFFF to ensure it's a 16-bit value.
  return crc & 0xffff; // Final CRC value
};
