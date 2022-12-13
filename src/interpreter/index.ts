// this is ugly af for now, don't judge me :(
const available_inputs = [
  0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf,
];
export type AvailableInputs = typeof available_inputs[number];
export type InputMap = Record<AvailableInputs, boolean>;

type Position = { x: number; y: number };

type Registers = {
  v: number[];
  i: number;
  vf: number;
};
type Screen = boolean[][];
type Timer = {
  interval_id: number | undefined;
  delay: number;
};

type State = {
  registers: Registers;
  memory: Uint8Array;
  screen: Screen;
  screen_element: CanvasRenderingContext2D;
  timer: Timer;
  sound: Timer;
  inputs: InputMap;
  instruction_index: number;
};

const MAX_SCREEN_HEIGHT = 32;
const MAX_SCREEN_WIDTH = 64;

const stack: number[] = [];

function create_screen(): Screen {
  return Array(MAX_SCREEN_HEIGHT)
    .fill(0)
    .map(() => Array(MAX_SCREEN_WIDTH).fill(false));
}

function create_empty_memory() {
  return new Uint8Array(4095);
}

function create_memory_from_program(program: Uint8Array) {
  const memory = create_empty_memory();
  memory.set(program, 512);
  return memory;
}

function get_upper_bits(value: number) {
  return value >> 4;
}

function get_low_bits(value: number) {
  return value & 0xf;
}

function get_addr(instruction: Uint8Array) {
  return (get_low_bits(instruction[0]) << 8) | instruction[1];
}

function get_nibble(instruction: Uint8Array) {
  return get_low_bits(instruction[1]);
}

function get_x(instruction: Uint8Array) {
  return get_low_bits(instruction[0]);
}

function get_y(instruction: Uint8Array) {
  return get_upper_bits(instruction[1]);
}

function get_kk(instruction: Uint8Array) {
  return instruction[1];
}

function draw_sprite(
  { memory, screen, screen_element, registers }: State,
  position: Position,
  sprite_address: number,
  sprite_height: number
) {
  registers.vf = 0;
  const sprite = memory.slice(sprite_address, sprite_address + sprite_height);
  for (let y = position.y; y < position.y + sprite_height; y++) {
    const sprite_row = sprite[y - position.y]
      .toString(2)
      .split("")
      .map((v) => v === "1");
    for (let x = position.x; x < position.x + 8; x++) {
      const current_pixel = screen[y % MAX_SCREEN_HEIGHT][x % MAX_SCREEN_WIDTH];
      const sprite_pixel = sprite_row[x - position.x];
      // collision
      if (current_pixel && sprite_pixel) {
        console.log("collision !", x, y);
        registers.vf = 1;
      }
      screen[y % MAX_SCREEN_HEIGHT][x % MAX_SCREEN_WIDTH] = !!(
        (current_pixel || sprite_pixel) &&
        current_pixel !== sprite_pixel
      );
    }
  }
}

function update_screen({ screen_element, screen }: State) {
  const scale = 10;
  screen_element.clearRect(
    0,
    0,
    MAX_SCREEN_WIDTH * scale,
    MAX_SCREEN_HEIGHT * scale
  );
  screen.map((row, y) =>
    row.map((pixel, x) => {
      if (!pixel) {
        return;
      }
      screen_element.fillRect(x * scale, y * scale, 1 * scale, 1 * scale);
    })
  );
}

function play_sound() {
  console.log("play sound");
}

function create_timer(timer: Timer, x: number, every_tick: () => void) {
  const clear_timer = () => {
    if (timer.interval_id) {
      clearTimeout(timer.interval_id);
      console.log("timer stopped");
    }
    timer.interval_id = undefined;
  };
  timer.delay = x;
  console.log("Set timer delay to", x);
  if (x === 0) {
    clear_timer();
    return;
  }
  console.log("starting timer");
  timer.interval_id = setInterval(() => {
    timer.delay--;
    every_tick();
    if (timer.delay === 0) {
      clear_timer();
    }
  }, 1000 / 60);
}

export async function create_runner(
  program_rom: ArrayBuffer,
  inputs: InputMap,
  screen_element: CanvasRenderingContext2D
) {
  const program_view = new Uint8Array(program_rom);
  let state: State = {
    registers: {
      v: Array(16).fill(0),
      i: 0,
      vf: 0,
    },
    memory: create_memory_from_program(program_view),
    screen: create_screen(),
    screen_element,
    timer: {
      interval_id: undefined,
      delay: 0,
    },
    sound: {
      interval_id: undefined,
      delay: 0,
    },
    inputs,
    instruction_index: 512,
  };
  console.log("length in bytes:", program_rom.byteLength);
  let loop: number | undefined;
  const start = () => {
    if (loop) return;
    loop = setInterval(() => {
      state = tick(state);
    }, 1000 / 500);
  };
  const stop = () => {
    if (!loop) return;
    clearInterval(loop);
    loop = undefined;
  };
  return { start, stop };
}

function tick(state: State): State {
  const { memory, registers, timer, sound, instruction_index, inputs } = state;
  const instruction = memory.subarray(instruction_index, instruction_index + 2);

  const op_code = get_upper_bits(instruction[0]);

  const new_state = (new_state: Partial<State> = {}): State => {
    return { ...state, instruction_index: instruction_index + 2, ...new_state };
  };
  console.log(
    `Instruction: <${instruction[0]
      .toString(16)
      .toLocaleUpperCase()} ${instruction[1]
      .toString(16)
      .toLocaleUpperCase()}> at ${instruction_index}`
  );

  if (instruction[0] === 0x00 && instruction[1] === 0xee) {
    const unstack_to = stack.shift();
    if (unstack_to === undefined) {
      throw new Error("Cannot unstack to " + unstack_to);
    }
    console.log("unstack to", unstack_to);
    return new_state({ instruction_index: unstack_to + 2 });
  }

  if (instruction[0] === 0x00 && instruction[1] === 0xe0) {
    console.log("clear screen");
    update_screen(state);
    return new_state({ screen: create_screen() });
  }

  // JMP nnn
  if (op_code === 0x1) {
    const jump_to = get_addr(instruction);
    console.log("jump to", jump_to);
    return new_state({ instruction_index: jump_to });
  }

  // CALL addr
  if (op_code === 0x2) {
    const raw_value = get_addr(instruction);
    const value = raw_value;
    stack.push(instruction_index);
    console.log("add to stack:", instruction_index);
    return new_state({ instruction_index: value });
  }

  // SE Vx, byte
  if (op_code === 0x3) {
    const x = get_x(instruction);
    const kk = get_kk(instruction);
    console.log(
      `V[${x}](=${registers.v[x]}) === ${kk} -> ${registers.v[x] === kk}`
    );
    if (registers.v[x] === kk) {
      console.log("skip next instruction");
      return new_state({ instruction_index: instruction_index + 4 });
    }
    console.log("not skipping");
    return new_state();
  }

  // SNE Vx, byte
  if (op_code === 0x4) {
    const x = get_x(instruction);
    const kk = get_kk(instruction);
    console.log(
      `V[${x}](=${registers.v[x]}) !== ${kk} -> ${registers.v[x] !== kk}`
    );
    if (registers.v[x] !== kk) {
      console.log("skip next instruction");
      return new_state({ instruction_index: instruction_index + 4 });
    }
    console.log("not skipping");
    return new_state();
  }

  // LD Vx, byte
  if (op_code === 0x6) {
    const register_id = get_x(instruction);
    const value = get_kk(instruction);
    registers.v[register_id] = value;
    console.log(`set register V[${register_id}] to ${value}`);
    return new_state();
  }

  // ADD Vx, byte
  if (op_code === 0x7) {
    const x = get_x(instruction);
    const kk = get_kk(instruction);

    const register_vx = registers.v[x];
    if (register_vx === undefined) {
      throw new Error(`V[${x}] should be defined`);
    }
    console.log(`add ${kk} to V[${x}] (=${register_vx})`);
    registers.v[x] = register_vx + kk;
    return new_state();
  }

  // ADD Vx, byte
  if (op_code === 0x8) {
    const x = get_x(instruction);
    const y = get_y(instruction);

    const register_vy = registers.v[y];
    if (register_vy === undefined) {
      throw new Error(`V[${y}] should be defined`);
    }
    console.log(`set V[${x}] to V[${y}](=${register_vy})`);
    registers.v[x] = register_vy;
    return new_state();
  }

  // LD Ix, addr
  if (op_code === 0xa) {
    const value = get_addr(instruction);
    registers.i = value;
    console.log(`set register I to ${registers.i}`);
    return new_state();
  }

  // DRW Vx, Vy, nibble
  if (op_code === 0xd) {
    const x_index = get_x(instruction);
    const y_index = get_y(instruction);
    const nibble = get_nibble(instruction);
    const x = registers.v[x_index];
    if (x === undefined) {
      throw new Error(`V[${x_index}] should be defined`);
    }
    const y = registers.v[y_index];
    if (y === undefined) {
      throw new Error(`V[${y_index}] should be defined`);
    }
    console.log(`draw with x: V[${x_index}](=${x}), y: V[${y_index}](=${y})`);
    draw_sprite(state, { x, y }, registers.i, nibble);
    update_screen(state);
    return new_state();
  }

  if (op_code === 0xe) {
    const x = get_x(instruction);
    const kk = get_kk(instruction);

    if (kk === 0xa1) {
      const register_vx = registers.v[x];
      if (register_vx === undefined) {
        throw new Error(`V[${x}] should be defined`);
      }
      console.log("waiting for", register_vx, "input");
      if (!inputs[register_vx]) {
        return new_state({ instruction_index: instruction_index + 4 });
      }
      return new_state();
    }
  }

  if (op_code === 0xf) {
    const x = get_x(instruction);
    const kk = get_kk(instruction);

    // LD Vx, DT
    if (kk === 0x07) {
      registers.v[x] = timer.delay;
      return new_state();
    }

    // LD ST, Vx
    if (kk === 0x07) {
      registers.v[x] = timer.delay;
      return new_state();
    }

    // LD DT, Vx
    if (kk === 0x15) {
      create_timer(timer, x, () => {});
      return new_state();
    }

    // LD ST, Vx
    if (kk === 0x18) {
      create_timer(sound, x, () => {
        play_sound();
      });
      return new_state();
    }

    // LD F, Vx
    if (kk === 0x29) {
      const register_vx = registers.v[x];
      if (register_vx === undefined) {
        throw new Error(`V[${x}] should be defined`);
      }
      registers.i = register_vx;
      console.log(`Set I(=${registers.i}) to V[${x}](=${register_vx})`);
      return new_state();
    }
  }

  console.log(
    `Unrecognized instruction: <${instruction[0]
      .toString(16)
      .toLocaleUpperCase()} ${instruction[1].toString(16).toLocaleUpperCase()}>`
  );
  throw new Error("Not implemented yet");
  return new_state();
}
