import { State } from ".";

export type Screen = { grid: boolean[][]; element: CanvasRenderingContext2D };
export type Position = { x: number; y: number };

export const MAX_SCREEN_HEIGHT = 32;
export const MAX_SCREEN_WIDTH = 64;

const internal_sprites = new Uint8Array([
  0xf0,
  0x90,
  0x90,
  0x90,
  0xf0, // 0
  0x20,
  0x60,
  0x20,
  0x20,
  0x70, // 1
  0xf0,
  0x10,
  0xf0,
  0x80,
  0xf0, // 2
  0xf0,
  0x10,
  0xf0,
  0x10,
  0xf0, // 3
  0x90,
  0x90,
  0xf0,
  0x10,
  0x10, // 4
  0xf0,
  0x80,
  0xf0,
  0x10,
  0xf0, // 5
  0xf0,
  0x80,
  0xf0,
  0x90,
  0xf0, // 6
  0xf0,
  0x10,
  0x20,
  0x40,
  0x40, // 7
  0xf0,
  0x90,
  0xf0,
  0x90,
  0xf0, // 8
  0xf0,
  0x90,
  0xf0,
  0x10,
  0xf0, // 9
  0xf0,
  0x90,
  0xf0,
  0x90,
  0x90, // A
  0xe0,
  0x90,
  0xe0,
  0x90,
  0xe0, // B
  0xf0,
  0x80,
  0x80,
  0x80,
  0xf0, // C
  0xe0,
  0x90,
  0x90,
  0x90,
  0xe0, // D
  0xf0,
  0x80,
  0xf0,
  0x80,
  0xf0, // E
  0xf0,
  0x80,
  0xf0,
  0x80,
  0x80, // F
]);

// TODO: improve screen grid (use Uint8Array ? an array of Uint8Array ? number[] ?)
export function create_screen_grid(): Screen["grid"] {
  return Array(MAX_SCREEN_HEIGHT)
    .fill(0)
    .map(() => Array(MAX_SCREEN_WIDTH).fill(false));
}

export function draw_sprite(
  { memory, screen, registers }: State,
  position: Position,
  sprite_address: number,
  sprite_height: number
) {
  registers.vf = 0;
  let sprite: Uint8Array;
  // TODO: improve the way it loads an internal sprite
  // it will depend on how the memory is improved
  if (sprite_address >= 0x0 && sprite_address <= internal_sprites.length) {
    sprite = internal_sprites.slice(
      sprite_address,
      sprite_address + sprite_height
    );
  } else {
    sprite = memory.slice(sprite_address, sprite_address + sprite_height);
  }
  for (let y = position.y; y < position.y + sprite_height; y++) {
    const sprite_row = sprite[y - position.y]
      .toString(2)
      .padStart(8, "0")
      .split("")
      .map((v) => v === "1");
    for (let x = position.x; x < position.x + 8; x++) {
      const current_pixel =
        screen.grid[y % MAX_SCREEN_HEIGHT][x % MAX_SCREEN_WIDTH];
      const sprite_pixel = sprite_row[x - position.x];
      // collision
      if (current_pixel && sprite_pixel) {
        registers.vf = 1;
      }
      screen.grid[y % MAX_SCREEN_HEIGHT][x % MAX_SCREEN_WIDTH] = !!(
        (current_pixel || sprite_pixel) &&
        current_pixel !== sprite_pixel
      );
    }
  }
}

export function update_screen({ screen: { element, grid } }: State) {
  const scale = 10;
  element.clearRect(0, 0, MAX_SCREEN_WIDTH * scale, MAX_SCREEN_HEIGHT * scale);
  grid.map((row, y) =>
    row.map((pixel, x) => {
      if (!pixel) {
        return;
      }
      element.fillRect(x * scale, y * scale, 1 * scale, 1 * scale);
    })
  );
}
