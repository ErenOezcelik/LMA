import { spawn } from "child_process";
import { startScheduler } from "../app/lib/scheduler.server.js";

// Start the email sync scheduler
startScheduler();

// Start the React Router dev/production server
const isProduction = process.env.NODE_ENV === "production";
const command = isProduction ? "react-router-serve" : "react-router";
const args = isProduction ? ["./build/server/index.js"] : ["dev"];

const server = spawn("npx", [command, ...args], {
  stdio: "inherit",
  env: { ...process.env },
});

server.on("close", (code) => {
  process.exit(code);
});

process.on("SIGINT", () => {
  server.kill("SIGINT");
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.kill("SIGTERM");
  process.exit(0);
});
