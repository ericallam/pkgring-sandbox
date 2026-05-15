export const CORE_VERSION_TAG = "core";

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

// Test 12 hotfix marker
export const HOTFIX_TEST_12 = true;
