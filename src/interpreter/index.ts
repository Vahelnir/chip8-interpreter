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
  // console.log(
  //   `Instruction: <${instruction[0]
  //     .toString(16)
  //     .toLocaleUpperCase()} ${instruction[1]
  //     .toString(16)
  //     .toLocaleUpperCase()}> at ${instruction_index}`
  // );

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
    const address_to_call = get_addr(instruction);
    stack.push(instruction_index);
    console.log("add to stack:", instruction_index, "current stack:", stack);
    return new_state({ instruction_index: address_to_call });
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

  // SE Vx, Vy
  if (op_code === 0x5) {
    const x = get_x(instruction);
    const y = get_y(instruction);
    console.log(
      `V[${x}](=${registers.v[x]}) === V[${y}](=${registers.v[y]}) -> ${
        registers.v[x] === registers.v[y]
      }`
    );
    if (registers.v[x] === registers.v[y]) {
      console.log("skip next instruction");
      return new_state({ instruction_index: instruction_index + 4 });
    }
    console.log("not skipping");
    return new_state();
  }

  // LD Vx, byte
  if (op_code === 0x6) {
    const x = get_x(instruction);
    const kk = get_kk(instruction);
    console.log(`set register V[${x}](=${registers.v[x]}) to ${kk}`);
    registers.v[x] = kk;
    return new_state();
  }

  // ADD Vx, byte
  if (op_code === 0x7) {
    const x = get_x(instruction);
    const kk = get_kk(instruction);
    console.log(`add ${kk} to V[${x}](=${registers.v[x]})`);
    registers.v[x] += kk;
    return new_state();
  }

  if (op_code === 0x8) {
    const x = get_x(instruction);
    const y = get_y(instruction);
    const nibble = get_nibble(instruction);

    //  LD Vx, Vy
    if (nibble === 0x0) {
      console.log(`set V[${x}] to V[${y}](=${registers.v[y]})`);
      registers.v[x] = registers.v[y];
      return new_state();
    }

    // OR Vx, Vy
    if (nibble === 0x1) {
      const or = registers.v[x] | registers.v[y];
      console.log(
        `set V[${x}] to V[${y}](=${registers.v[x]}) OR V[${x}](=${registers.v[y]}), is now '${or}'`
      );
      registers.v[x] = or;
      return new_state();
    }

    // AND Vx, Vy
    if (nibble === 0x2) {
      const and = registers.v[x] & registers.v[y];
      console.log(
        `set V[${x}] to V[${x}](=${registers.v[x]}) AND V[${y}](=${registers.v[x]}), is now '${and}'`
      );
      registers.v[x] = and;
      return new_state();
    }

    // XOR Vx, Vy
    if (nibble === 0x3) {
      const xor = registers.v[x] ^ registers.v[y];
      registers.vf = +(xor !== (registers.v[x] | registers.v[y]));
      console.log(
        `set V[${x}] to V[${x}](=${registers.v[x]}) XOR V[${y}](=${registers.v[y]}), is now '${xor}'`
      );
      registers.v[x] = xor;
      return new_state();
    }

    // ADD Vx, Vy
    if (nibble === 0x4) {
      const sum = registers.v[x] + registers.v[y];
      registers.vf = +(sum > 255);
      console.log(
        `set V[${x}] to V[${x}](=${registers.v[x]}) + V[${y}](=${registers.v[y]}), carry: ${registers.vf}`
      );
      registers.v[x] = sum & 0x0ff;
      return new_state();
    }

    // SUB Vx, Vy
    if (nibble === 0x5) {
      registers.vf = +(registers.v[x] < registers.v[y]);
      console.log(
        `set V[${x}] to V[${x}](=${registers.v[x]}) - V[${y}](=${registers.v[y]})`
      );
      registers.v[x] -= registers.v[y];
      return new_state();
    }

    // SHR Vx, Vy
    if (nibble === 0x6) {
      registers.vf = +(registers.v[x] & 0x1);
      const shifted = registers.v[x] >> 1;
      console.log(`right shift V[${x}](=${registers.v[x]}), is now ${shifted}`);
      registers.v[x] = shifted;
      return new_state();
    }

    // RSB Vx, Vy
    if (nibble === 0x7) {
      registers.vf = +(registers.v[y] < registers.v[x]);
      console.log(
        `set V[${x}] to V[${y}](=${registers.v[y]}) - V[${x}](=${registers.v[x]})`
      );
      registers.v[x] = registers.v[y] - registers.v[x];
      return new_state();
    }

    // SHL Vx, Vy
    if (y === 0x0 && nibble === 0xe) {
      registers.vf = +(registers.v[x] & 0x80);
      const shifted = registers.v[x] << 1;
      console.log(`right shift V[${x}](=${registers.v[x]}), is now ${shifted}`);
      registers.v[x] = shifted;
      return new_state();
    }
  }

  // SNE Vx, Vy
  if (op_code === 0x9) {
    const x = get_x(instruction);
    const y = get_y(instruction);
    console.log(
      `V[${x}](=${registers.v[x]}) !== V[${y}](=${registers.v[y]}) -> ${
        registers.v[x] !== registers.v[y]
      }`
    );
    if (registers.v[x] !== registers.v[y]) {
      console.log("skip next instruction");
      return new_state({ instruction_index: instruction_index + 4 });
    }
    console.log("not skipping");
    return new_state();
  }

  // LD Ix, addr
  if (op_code === 0xa) {
    const value = get_addr(instruction);
    registers.i = value;
    console.log(`set register I to ${registers.i}`);
    return new_state();
  }

  // JP V0, addr
  if (op_code === 0xb) {
    const jump_to = get_addr(instruction);
    console.log(`jump to ${jump_to} + ${registers.v[0]}`);
    return new_state({ instruction_index: jump_to + registers.v[0] });
  }

  // RND Vx, byte
  if (op_code === 0xc) {
    const x = get_x(instruction);
    const kk = get_kk(instruction);
    const random = Math.floor(Math.random() * 256);
    registers.v[x] = random & kk;
    return new_state();
  }

  // DRW Vx, Vy, nibble
  if (op_code === 0xd) {
    const x_index = get_x(instruction);
    const y_index = get_y(instruction);
    const nibble = get_nibble(instruction);
    const x = registers.v[x_index];
    const y = registers.v[y_index];
    console.log(`draw with x: V[${x_index}](=${x}), y: V[${y_index}](=${y})`);
    draw_sprite(state, { x, y }, registers.i, nibble);
    update_screen(state);
    return new_state();
  }

  if (op_code === 0xe) {
    const x = get_x(instruction);
    const kk = get_kk(instruction);

    if (kk === 0xa1) {
      console.log("waiting for", registers.v[x], "input");
      if (!inputs[registers.v[x]]) {
        console.log("input ", registers.v[x], "pressed");
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
      registers.v[x] = timer.sound;
      return new_state();
    }

    // LD DT, Vx
    if (kk === 0x15) {
      console.log("Set timer delay to", x);
      return new_state({ timer: { ...timer, timer: x } });
    }

    // LD ST, Vx
    if (kk === 0x18) {
      console.log("Set sound delay to", x);
      return new_state({ timer: { ...timer, sound: x } });
    }

    // LD F, Vx
    if (kk === 0x29) {
      registers.i = registers.v[x] * 5;
      console.log(`Set I(=${registers.i}) to V[${x}](=${registers.v[x]})`);
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
