import { CORE_VERSION_TAG } from "@pkgring/core";
import { loudWelcome, welcome } from "@pkgring/sdk";

const args = process.argv.slice(2);
const loud = args.includes("--loud");
const name = args.filter((a) => !a.startsWith("--"))[0] ?? "world";
const result = loud ? loudWelcome(name) : welcome(name);

console.log(JSON.stringify({ ...result, tag: CORE_VERSION_TAG }, null, 2));
