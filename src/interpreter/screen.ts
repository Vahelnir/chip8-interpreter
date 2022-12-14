import { State } from ".";

export type Screen = { grid: boolean[][]; element: CanvasRenderingContext2D };
export type Position = { x: number; y: number };

export const MAX_SCREEN_HEIGHT = 32;
export const MAX_SCREEN_WIDTH = 64;

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
  const sprite = memory.slice(sprite_address, sprite_address + sprite_height);
  for (let y = position.y; y < position.y + sprite_height; y++) {
    const sprite_row = sprite[y - position.y]
      .toString(2)
      .split("")
      .map((v) => v === "1");
    for (let x = position.x; x < position.x + 8; x++) {
      const current_pixel =
        screen.grid[y % MAX_SCREEN_HEIGHT][x % MAX_SCREEN_WIDTH];
      const sprite_pixel = sprite_row[x - position.x];
      // collision
      if (current_pixel && sprite_pixel) {
        console.log("collision !", x, y);
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
