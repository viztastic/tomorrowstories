import { defineConfig } from "vitest/config";
import * as fs from "node:fs";
import * as path from "node:path";

// The backend source uses NodeNext-style ".js" import specifiers that resolve to
// ".ts" files. Vite doesn't do that mapping by default, so this tiny plugin does.
function jsToTs() {
  return {
    name: "js-to-ts",
    enforce: "pre" as const,
    resolveId(source: string, importer?: string) {
      if (importer && source.startsWith(".") && source.endsWith(".js")) {
        const candidate = path.resolve(path.dirname(importer), source.replace(/\.js$/, ".ts"));
        if (fs.existsSync(candidate)) return candidate;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [jsToTs()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
  },
});
