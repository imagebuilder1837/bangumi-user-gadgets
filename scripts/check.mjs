import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { generate } from "./build.mjs";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
assert.equal(pkg.version, "0.1.0", "版本变更需要逐字段批准");
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[""].version, pkg.version);
assert.deepEqual(pkg.dependencies || {}, {});
assert.deepEqual(pkg.devDependencies, {
  jsdom: "^20.0.3",
  prettier: "3.6.2",
  rollup: "4.60.0",
});
assert.deepEqual(lock.packages[""].devDependencies, pkg.devDependencies);
assert.equal(lock.packages["node_modules/rollup"].version, "4.60.0");
assert.equal(lock.packages["node_modules/prettier"].version, "3.6.2");
const metadata = await readFile("src/metadata.txt");
assert.equal(
  createHash("sha256").update(metadata).digest("hex"),
  "0c49d3a3cab97d1d72818d46f0df3ea9338993ce4c52c770bf5c24c05f626f2c",
  "metadata 改动需要批准并更新治理基线",
);
for (const dir of ["src", "scripts", "test"]) {
  for (const name of await readdir(dir))
    if (/\.(mjs|js)$/.test(name))
      execFileSync(process.execPath, ["--check", `${dir}/${name}`], {
        stdio: "inherit",
      });
}
execFileSync("node_modules/.bin/prettier", ["--check", "."], {
  stdio: "inherit",
});
assert.equal(
  await readFile("src/index.user.js", "utf8"),
  await generate(),
  "生成物过期，请单独 build",
);
execFileSync(process.execPath, ["--test"], { stdio: "inherit" });
