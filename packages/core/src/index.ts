export const CORE_VERSION_TAG = "core";
export const VOLUME_LEVELS = ["whisper", "normal", "shout"] as const;

export type Greeting = {
  message: string;
  source: "core";
};

export function greet(name: string): Greeting {
  return { message: `hello, ${name}`, source: "core" };
}

export function farewell(name: string): Greeting {
  return { message: `goodbye, ${name}`, source: "core" };
}

export function shout(name: string): Greeting {
  return { message: `HEY THERE, ${name.toUpperCase()}!!!`, source: "core" };
}

export function whisper(name: string): Greeting {
  return { message: `(psst, hey ${name.toLowerCase()})`, source: "core" };
}
