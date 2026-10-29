import type { Cell } from "../geometry/rules";
export type Level = {
  name: string;
  topic: string;
  description: string;
  start: Cell[];
  target: Cell[];
};
export const levels: Level[] = [
  {
    name: "Around the corner",
    topic: "01 / Rotation",
    description:
      "Keep the pair together. Rotate the right square around its neighbour to match the outline.",
    start: [
      [0, 0],
      [1, 0],
    ],
    target: [
      [0, 0],
      [0, 1],
    ],
  },
  {
    name: "Along the edge",
    topic: "02 / Sliding",
    description:
      "The upper square can slide along two supports. Move it to the other end of the base.",
    start: [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
    ],
    target: [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
  },
  {
    name: "Keep the connection",
    topic: "03 / Connectivity",
    description:
      "The middle square is a bridge. Move an endpoint around it to form the target corner.",
    start: [
      [-1, 0],
      [0, 0],
      [1, 0],
    ],
    target: [
      [-1, 0],
      [0, 0],
      [0, 1],
    ],
  },
  {
    name: "Open the square",
    topic: "04 / Clearance",
    description:
      "A full block leaves no room for an inward rotation. Explore its outer corners to make an L.",
    start: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    target: [
      [0, 0],
      [1, 0],
      [0, 1],
      [0, 2],
    ],
  },
];
