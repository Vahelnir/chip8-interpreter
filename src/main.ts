import { create_runner, AvailableInputs, InputMap } from "./interpreter";
const inputs: InputMap = {
  0x1: false,
  0x2: false,
  0x3: false,
  0x4: false,
  0x5: false,
  0x6: false,
  0x7: false,
  0x8: false,
  0x9: false,
  0xa: false,
  0xb: false,
  0xc: false,
  0xd: false,
  0xe: false,
  0xf: false,
};

const input_mappings: Record<string, AvailableInputs> = {
  Digit1: 1,
  Digit2: 2,
  Digit3: 3,
  Digit4: 4,
  Digit5: 5,
  Digit6: 6,
  Digit7: 7,
  Digit8: 8,
  Digit9: 9,
  KeyQ: 0xa,
  KeyB: 0xb,
  KeyC: 0xc,
  KeyD: 0xd,
  KeyE: 0xe,
  KeyF: 0xf,
};

const app = document.getElementById("app");

let running = false;

function create_control_button(
  root: HTMLElement,
  controls: { start(): void; stop(): void }
) {
  const button = document.createElement("button");
  button.innerText = "Start";
  button.addEventListener("click", () => {
    if (running) {
      running = false;
      controls.stop();
      button.innerText = "Start";
    } else {
      running = true;
      controls.start();
      button.innerText = "Stop";
    }
  });
  root.appendChild(button);
}

async function load_rom(path: string) {
  const response = await fetch(path);
  return await response.arrayBuffer();
}

function create_screen_context(root: HTMLElement) {
  const screen_element = document.createElement("canvas");
  screen_element.style.background = "lightgrey";
  const screen_context = screen_element.getContext("2d");
  if (!screen_context) {
    throw new Error("no 2d context");
  }
  screen_element.width = 640;
  screen_element.height = 320;

  root.appendChild(screen_element);
  return screen_context;
}

(async () => {
  if (!app) {
    throw new Error("no #app element");
  }
  window.addEventListener("keyup", (event) => {
    const mapping = input_mappings[event.code];
    if (mapping) {
      inputs[mapping] = false;
    }
  });
  window.addEventListener("keydown", (event) => {
    const mapping = input_mappings[event.code];
    if (mapping) {
      inputs[mapping] = true;
    }
  });
  const screen_context = create_screen_context(app);
  const rom = await load_rom("./roms/games/Airplane.ch8");
  const controls = await create_runner(rom, inputs, screen_context);

  create_control_button(app, controls);
})();
