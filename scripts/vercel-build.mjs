import { execFileSync } from "node:child_process";

const run = (command, args) => execFileSync(command, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (process.env.VERCEL_ENV === "production") {
  run("npx", ["prisma", "migrate", "deploy"]);
}

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);
