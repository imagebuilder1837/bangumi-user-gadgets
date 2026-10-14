import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { host, settle } from "./support/fixtures.mjs";

const bundle = readFileSync(
  new URL("../src/index.user.js", import.meta.url),
  "utf8",
);
const template = readFileSync(
  new URL("../src/metadata.txt", import.meta.url),
  "utf8",
);
const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const lock = JSON.parse(
  readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
);

test("installable bundle carries the exact human-maintained header and no development imports", () => {
  const header = template.replace("{{VERSION}}", version).trimEnd();
  assert.ok(bundle.startsWith(`${header}\n\n`));
  assert.equal((bundle.match(/==UserScript==/g) || []).length, 1);
  assert.doesNotMatch(
    bundle,
    /Development bundle only|^\s*(?:import|export)\s|\bmodule\.exports\b|sourceMappingURL/m,
  );
  assert.equal(bundle.includes("{{VERSION}}"), false);
});

test("installable version agrees with the dependency lockfile", () => {
  assert.equal(lock.version, version);
  assert.equal(lock.packages[""].version, version);
});

test("生成物在代表宿主页初始化并展示裁剪脱敏原始响应", async () => {
  const dom = new JSDOM(host, {
    url: "https://bgm.tv/user/alice#gadgets",
    runScripts: "outside-only",
  });
  dom.window.scrollTo = () => {};
  const html = await readFile(
    new URL("./fixtures/garage.html", import.meta.url),
    "utf8",
  );
  let request;
  dom.window.fetch = async (url, options) => {
    request = { url, options };
    return new Response(html);
  };
  dom.window.eval(
    await readFile(new URL("../src/index.user.js", import.meta.url), "utf8"),
  );
  await settle();
  assert.equal(
    dom.window.document.querySelector("[data-user-gadgets-item] h3 a")
      .textContent,
    "评分显示优化",
  );
  assert.equal(request.url, "https://bgm.tv/dev/garage");
  assert.equal(request.options.credentials, "same-origin");
  assert.equal(
    dom.window.document.querySelectorAll("[data-user-gadgets-view] .badge_tag")
      .length,
    5,
  );
  dom.window.close();
});
