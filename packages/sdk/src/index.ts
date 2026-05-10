import { greet, shout, whisper, type Greeting } from "@pkgring/core";

export type Welcome = Greeting & { wrappedBy: "sdk" };

export function welcome(name: string): Welcome {
  return { ...greet(name), wrappedBy: "sdk" };
}

export function loudWelcome(name: string): Welcome {
  return { ...shout(name), wrappedBy: "sdk" };
}

export function quietWelcome(name: string): Welcome {
  return { ...whisper(name), wrappedBy: "sdk" };
}
