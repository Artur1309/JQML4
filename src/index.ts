#!/usr/bin/env node
/**
 * jqml4 – CLI entry point
 *
 * Usage:
 *   jqml4 build --entry <path/to/main.qml> [--out <dir>]
 */

import * as fs from "fs";
import * as path from "path";
import { parseQml } from "./qml/parser";
import { emit } from "./emit/web";

function printHelp(): void {
  console.log(`
jqml4 – Transpile a minimal subset of QML into a Canvas-based web app

Usage:
  jqml4 build --entry <path/to/main.qml> [--out <dir>]

Options:
  --entry  Path to the root QML file (required)
  --out    Output directory (default: dist)
  --help   Show this help message
`.trim());
}

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        result[key] = next;
        i++;
      } else {
        result[key] = "true";
      }
    } else {
      // Positional
      result["_command"] = arg;
    }
  }
  return result;
}

function main(): void {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    printHelp();
    process.exit(0);
  }

  const command = argv[0];
  const args = parseArgs(argv.slice(1));

  if (args["help"] === "true") {
    printHelp();
    process.exit(0);
  }

  if (command !== "build") {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  const entryArg = args["entry"];
  if (!entryArg) {
    console.error("Error: --entry is required");
    printHelp();
    process.exit(1);
  }

  const entryPath = path.resolve(entryArg);
  if (!fs.existsSync(entryPath)) {
    console.error(`Error: entry file not found: ${entryPath}`);
    process.exit(1);
  }

  const outDir = path.resolve(args["out"] ?? "dist");

  console.log(`Building: ${entryPath} → ${outDir}`);

  let source: string;
  try {
    source = fs.readFileSync(entryPath, "utf8");
  } catch (err) {
    console.error(`Error reading file: ${entryPath}`);
    console.error(err);
    process.exit(1);
  }

  let root;
  try {
    root = parseQml(source);
  } catch (err) {
    console.error("Parse error:");
    console.error(err);
    process.exit(1);
  }

  try {
    emit(root, path.dirname(entryPath), outDir);
  } catch (err) {
    console.error("Emit error:");
    console.error(err);
    process.exit(1);
  }

  console.log(`\nDone! Open ${path.join(outDir, "index.html")} in a browser.`);
}

main();
