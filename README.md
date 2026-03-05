# JQML4

A Node.js 20 + TypeScript CLI that transpiles a minimal subset of QML into a Canvas-based web app.

## Requirements

- Node.js 20 or later
- npm 9 or later

## Install & Build

```bash
npm i
npm run build
```

This compiles TypeScript from `src/` into `build/`.

## Usage

```bash
# Using the installed binary (after npm link or npm i -g)
jqml4 build --entry path/to/main.qml

# Or directly via Node
node build/index.js build --entry path/to/main.qml

# Custom output directory (default is dist/)
node build/index.js build --entry path/to/main.qml --out my-output
```

## Output

Running `jqml4 build` creates the output directory (default: `dist/`) containing:

| File | Description |
|------|-------------|
| `index.html` | HTML shell with inlined app data |
| `runtime.js` | Canvas2D renderer (no dependencies) |
| `app.json` | Parsed QML IR |
| `assets/` | Copied image assets (if any) |

## Opening in a Browser

The generated `index.html` works when opened directly via `file://` — no local server needed.
The app data is inlined into the HTML so there are no CORS issues.

```bash
# macOS
open dist/index.html

# Linux
xdg-open dist/index.html

# Windows
start dist/index.html
```

## Supported QML Subset

**Element types:** `Item`, `Rectangle`, `Text`, `Image`, `MouseArea`

**Properties:** `id`, `x`, `y`, `width`, `height`, `color`, `text`, `source`, `fontSize`

**Example:**

```qml
import QtQuick 2.0

Rectangle {
    id: root
    width: 800
    height: 600
    color: "white"

    Text {
        x: 20
        y: 20
        text: "Hello, JQML4!"
        color: "black"
        fontSize: 32
    }

    Rectangle {
        x: 20
        y: 80
        width: 200
        height: 100
        color: "#4488ff"
    }
}
```

## Project Structure

```
src/
  index.ts          CLI entry point
  qml/
    parser.ts       Minimal QML → IR parser
  emit/
    web.ts          IR → HTML/JS/JSON emitter
build/              TypeScript compiler output (git-ignored)
dist/               jqml4 build output (git-ignored)
```
