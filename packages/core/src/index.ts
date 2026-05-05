export const CORE_VERSION_TAG = "core";

export type Greeting = {
  message: string;
  source: "core";
};

export function greet(name: string): Greeting {
  return { message: `hello, ${name}`, source: "core" };
}
