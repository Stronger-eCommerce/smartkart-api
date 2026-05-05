import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/schemas.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2022",
  },
  {
    entry: { "mcp-server": "src/mcp/index.ts" },
    format: ["esm"],
    sourcemap: true,
    clean: false,
    target: "es2022",
    banner: { js: "#!/usr/bin/env node" },
  },
]);
