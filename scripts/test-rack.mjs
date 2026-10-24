import { build } from "esbuild";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const temporary = mkdtempSync(join(root, "node_modules", ".rack-tests-"));
try {
  const result = await build({
    entryPoints: [join(root, "tests", "rack.test.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    write: false,
    tsconfig: join(root, "tsconfig.json"),
  });
  const entry = join(temporary, "rack.test.mjs");
  writeFileSync(entry, result.outputFiles[0].text);
  const run = spawnSync(process.execPath, ["--test", entry], { cwd: root, stdio: "inherit" });
  if (run.error) throw run.error;
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
