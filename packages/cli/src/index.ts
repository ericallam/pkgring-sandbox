import { CORE_VERSION_TAG } from "@pkgring/core";
import { welcome } from "@pkgring/sdk";

const name = process.argv[2] ?? "world";
const result = welcome(name);

console.log(JSON.stringify({ ...result, tag: CORE_VERSION_TAG }, null, 2));
