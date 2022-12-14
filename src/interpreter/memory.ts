export type Memory = Uint8Array;

// TODO: refactor this to not use 4095 bytes when we only use like 512 bytes

export function create_empty_memory(): Memory {
  return new Uint8Array(4095);
}

export function create_memory_from_program(program: Uint8Array): Memory {
  const memory = create_empty_memory();
  memory.set(program, 512);
  return memory;
}
