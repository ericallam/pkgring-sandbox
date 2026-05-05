import { greet, type Greeting } from "@pkgring/core";

export type Welcome = Greeting & { wrappedBy: "sdk" };

export function welcome(name: string): Welcome {
  return { ...greet(name), wrappedBy: "sdk" };
}
