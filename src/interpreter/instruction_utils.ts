export function get_upper_bits(value: number) {
  return value >> 4;
}

export function get_low_bits(value: number) {
  return value & 0xf;
}

export function get_addr(instruction: Uint8Array) {
  return (get_low_bits(instruction[0]) << 8) | instruction[1];
}

export function get_nibble(instruction: Uint8Array) {
  return get_low_bits(instruction[1]);
}

export function get_x(instruction: Uint8Array) {
  return get_low_bits(instruction[0]);
}

export function get_y(instruction: Uint8Array) {
  return get_upper_bits(instruction[1]);
}

export function get_kk(instruction: Uint8Array) {
  return instruction[1];
}
