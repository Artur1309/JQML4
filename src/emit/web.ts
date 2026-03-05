/**
 * Emitter: takes the parsed QML IR and writes the web output files.
 *
 * Output:
 *   <outDir>/index.html   – HTML shell with inlined app data, loads runtime.js
 *   <outDir>/runtime.js   – Canvas2D renderer (no dependencies)
 *   <outDir>/app.json     – Parsed IR (also inlined in index.html for file:// support)
 *   <outDir>/assets/      – Copied image assets (relative `source` paths only)
 */

import * as fs from "fs";
import * as path from "path";
import { QmlNode } from "../qml/parser";

/** Collect all Image nodes and rewrite relative source paths to assets/<basename>. */
function collectAndRewriteImages(
  node: QmlNode,
  entryDir: string,
  outDir: string
): void {
  if (node.type === "Image" && typeof node.props["source"] === "string") {
    const src = node.props["source"] as string;
    // Only copy relative paths (not http/https/data URIs)
    if (!src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("data:")) {
      const absSource = path.resolve(entryDir, src);
      const basename = path.basename(src);
      const assetsDir = path.join(outDir, "assets");
      fs.mkdirSync(assetsDir, { recursive: true });
      if (fs.existsSync(absSource)) {
        fs.copyFileSync(absSource, path.join(assetsDir, basename));
      }
      node.props["source"] = `assets/${basename}`;
    }
  }
  for (const child of node.children) {
    collectAndRewriteImages(child, entryDir, outDir);
  }
}

function buildRuntimeJs(): string {
  return `(function () {
  "use strict";

  var root = window.__APP__ && window.__APP__.root;
  if (!root) { console.error("jqml4: no app data"); return; }

  var canvas = document.getElementById("canvas");
  var ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
  }

  var imgCache = {};
  function loadImage(src, cb) {
    if (imgCache[src]) { cb(imgCache[src]); return; }
    var img = new Image();
    img.onload = function () { imgCache[src] = img; cb(img); };
    img.src = src;
  }

  function renderNode(node, parentX, parentY) {
    parentX = parentX || 0;
    parentY = parentY || 0;
    var p = node.props || {};
    var x = (p.x || 0) + parentX;
    var y = (p.y || 0) + parentY;
    var w = p.width || 0;
    var h = p.height || 0;

    switch (node.type) {
      case "Rectangle":
      case "Item":
        if (w > 0 && h > 0) {
          ctx.fillStyle = p.color || "transparent";
          if (p.color && p.color !== "transparent") {
            ctx.fillRect(x, y, w, h);
          }
        }
        break;
      case "Text": {
        var fontSize = p.fontSize || 16;
        ctx.font = fontSize + "px sans-serif";
        ctx.fillStyle = p.color || "#000000";
        ctx.fillText(p.text || "", x, y + fontSize);
        break;
      }
      case "Image":
        if (p.source) {
          loadImage(p.source, function (img) {
            var iw = w > 0 ? w : img.naturalWidth;
            var ih = h > 0 ? h : img.naturalHeight;
            ctx.drawImage(img, x, y, iw, ih);
          });
        }
        break;
      default:
        break;
    }

    var children = node.children || [];
    for (var i = 0; i < children.length; i++) {
      renderNode(children[i], x, y);
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderNode(root, 0, 0);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(render);
}());
`;
}

function buildIndexHtml(appJson: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JQML4 App</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    canvas { display: block; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script>window.__APP__ = ${appJson};</script>
  <script src="runtime.js"></script>
</body>
</html>
`;
}

export function emit(root: QmlNode, entryDir: string, outDir: string): void {
  fs.mkdirSync(outDir, { recursive: true });

  // Rewrite image sources and copy assets
  collectAndRewriteImages(root, entryDir, outDir);

  const appData = { root };
  const appJson = JSON.stringify(appData, null, 2);

  // Write app.json
  fs.writeFileSync(path.join(outDir, "app.json"), appJson, "utf8");

  // Write runtime.js
  fs.writeFileSync(path.join(outDir, "runtime.js"), buildRuntimeJs(), "utf8");

  // Write index.html with inlined app data (works with file://)
  const inlinedJson = JSON.stringify(appData);
  fs.writeFileSync(path.join(outDir, "index.html"), buildIndexHtml(inlinedJson), "utf8");

  console.log(`✓ Wrote ${path.join(outDir, "index.html")}`);
  console.log(`✓ Wrote ${path.join(outDir, "runtime.js")}`);
  console.log(`✓ Wrote ${path.join(outDir, "app.json")}`);
}
