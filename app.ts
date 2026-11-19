import express from "express";
import path from "node:path";
import { createApp } from "./server/_core/app";

// Keep an explicit Express import in the Vercel entrypoint for framework detection.
void express;

const app = createApp();
const publicDir = path.join(process.cwd(), "public");

app.use(express.static(publicDir));
app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

export default app;
