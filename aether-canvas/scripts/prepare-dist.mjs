import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareStaticDist } from "./lib/dist-manifest.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const manifest = await prepareStaticDist(rootDir, distDir);
process.stdout.write(
  `Prepared static dist at ${distDir} with ${manifest.entry_count} tracked files\n`,
);
