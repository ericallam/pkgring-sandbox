import { greet, type Greeting } from "@pkgring/core";

export type Welcome = Greeting & { wrappedBy: "sdk" };

export function welcome(name: string): Welcome {
  const safeName = name.trim() || "stranger";
  return { ...greet(safeName), wrappedBy: "sdk" };
}
