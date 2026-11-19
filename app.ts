import express from "express";
import { createApp } from "./server/_core/app";

// Keep an explicit Express import in the Vercel entrypoint for framework detection.
void express;
export default createApp();
