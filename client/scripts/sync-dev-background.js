#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const source = path.join(root, "assets", "Loading", "res", "bg.png");
const targets = [
    path.join(root, "build-templates", "web-mobile", "dev-splash-bg.png"),
    path.join(root, "build", "web-mobile", "dev-splash-bg.png")
];

if (!fs.existsSync(source)) {
    console.error("[sync-dev-background] Source not found:", source);
    process.exit(1);
}

for (const target of targets) {
    const dir = path.dirname(target);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(source, target);
    console.log("[sync-dev-background] Copied:", target);
}

console.log("[sync-dev-background] Done.");
