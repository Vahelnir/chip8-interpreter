import {
  get_addr,
  get_kk,
  get_nibble,
  get_upper_bits,
  get_x,
  get_y,
} from "./instruction_utils";
import { create_memory_from_program, Memory } from "./memory";
import {
  Screen,
  create_screen_grid,
  draw_sprite,
  update_screen,
} from "./screen";

// this is ugly af for now, don't judge me :(
const available_inputs = [
  0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf,
];
export type AvailableInputs = typeof available_inputs[number];
export type InputMap = Record<AvailableInputs, boolean>;

export type Registers = {
  v: number[];
  i: number;
  vf: number;
};

export type Delay = {
  interval_id: number | undefined;
  timer: number;
  sound: number;
};

export type State = {
  registers: Registers;
  memory: Memory;
  screen: Screen;
  timer: Delay;
  inputs: InputMap;
  instruction_index: number;
};

const stack: number[] = [];

function play_sound() {
  console.log("play sound");
}

type Controls = {
  start(): void;
  stop(): void;
  is_running(): void;
};
type ControlledTimer = Controls & {
  delay: Delay;
};
function create_timer(): ControlledTimer {
  const delay = { timer: 0, sound: 0 };
  let interval_id: number | undefined;
  return {
    start() {
      if (interval_id !== undefined) {
        return;
      }
      console.log("timer & sound started");
      interval_id = setInterval(() => {
        if (delay.timer > 0) {
          delay.timer--;
        }

        if (delay.sound > 0) {
          play_sound();
          delay.sound--;
        }
      }, 1000 / 60);
    },
    stop() {
      if (interval_id === undefined) {
        return;
      }
      clearInterval(interval_id);
      interval_id = undefined;
      console.log("timer & sound stopped");
    },
    is_running() {},
    delay: { ...delay, interval_id },
  };
}

export async function create_runner(
  program_rom: ArrayBuffer,
  inputs: InputMap,
  screen_element: CanvasRenderingContext2D
): Promise<Controls> {
  const program_view = new Uint8Array(program_rom);
  const controlled_timer = create_timer();
  let state: State = {
    registers: {
      v: Array(16).fill(0),
      i: 0,
      vf: 0,
    },
    memory: create_memory_from_program(program_view),
    screen: { grid: create_screen_grid(), element: screen_element },
    timer: controlled_timer.delay,
    inputs,
    instruction_index: 512,
  };

  let loop: number | undefined;
  const stop = () => {
    if (loop === undefined) return;
    controlled_timer.stop();
    clearInterval(loop);
    loop = undefined;
  };

  const start = () => {
    if (loop !== undefined) return;
    controlled_timer.start();
    loop = setInterval(() => {
      try {
        state = tick(state);
      } catch (err) {
        stop();
        console.error(err);
      }
    }, 1000 / 500);
  };

  const is_running = () => controlled_timer.delay.interval_id !== undefined;

  return { start, stop, is_running };
}

function tick(state: State): State {
  const { memory, registers, timer, instruction_index, inputs, screen } = state;
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
    return new_state({
      screen: { grid: create_screen_grid(), element: screen.element },
    });
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
      registers.v[x] = timer.timer;
      return new_state();
    }

    // LD ST, Vx
    if (kk === 0x07) {
      registers.v[x] = timer.timer;
      return new_state();
    }

    // LD DT, Vx
    if (kk === 0x15) {
      timer.timer = x;
      console.log("Set timer delay to", x);
      return new_state();
    }

    // LD ST, Vx
    if (kk === 0x18) {
      timer.sound = x;
      console.log("Set sound delay to", x);
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
}
