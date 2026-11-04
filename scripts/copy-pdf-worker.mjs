import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
mkdirSync("public", { recursive: true });
copyFileSync(source, "public/pdf.worker.min.js");
