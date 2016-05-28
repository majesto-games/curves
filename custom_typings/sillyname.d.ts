declare module "sillyname" {
  export default function generateStupidName(generator?: () => number): string;
  export function randomNoun(generator?: () => number): string;
  export function randomAdjective(generator?: () => number): string;
}