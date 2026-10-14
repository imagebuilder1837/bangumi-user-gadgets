import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { startApp } from "../src/entry.mjs";
import {
  host,
  card,
  garage,
  settle,
  fakeTime,
  setup,
} from "./support/fixtures.mjs";

for (const [name, html] of [
  ["缺作者", garage(card().replace("/user/alice", "/unknown/alice"))],
  ["缺 ID", garage(card().replace('id="item_31"', ""))],
  ["冲突 ID", garage(card() + card().replace("评分显示优化", "不同标题"))],
  [
    "不完整集合",
    garage() + '<a rel="next" href="/dev/garage?page=2">下一页</a>',
  ],
  ["验证页面", '<form action="/captcha">验证</form>'],
  ["错误结构", '<ul class="gadgetList"></ul>'],
])
  test(`${name}明确失败，不自动重试`, async () => {
    let reads = 0;
    const { d, w, app } = setup(
      "https://bgm.tv/user/alice#gadgets",
      async () => {
        reads++;
        return new Response(html);
      },
    );
    await settle();
    assert.ok(d.querySelector("[data-user-gadgets-view] button"));
    assert.equal(reads, 1);
    w.location.hash = "";
    await settle();
    w.location.hash = "#gadgets";
    await settle();
    assert.equal(reads, 1);
    app.stop();
    w.close();
  });

test("一致重复 ID 保留首次，缺排序字段与坏分类不丢卡片", async () => {
  const html = garage(card() + card())
    .replace(/21014/g, "未知")
    .replace(/2018-2-26 19:21/g, "未知")
    .replace("var tagCategories =", "var invalid =");
  const { d, w, app } = setup(
    "https://bgm.tv/user/alice#gadgets",
    async () => new Response(html),
  );
  await settle();
  assert.equal(d.querySelectorAll("[data-user-gadgets-item]").length, 1);
  app.stop();
  w.close();
});

for (const failure of ["network", "timeout", 408, 500])
  test(`${failure} 在 1 秒、2 秒后有限重试`, async () => {
    const dom = new JSDOM(host, { url: "https://bgm.tv/user/alice#gadgets" });
    dom.window.scrollTo = () => {};
    const time = fakeTime();
    let reads = 0;
    const app = startApp({
      window: dom.window,
      timers: time,
      now: time.now,
      fetch: () => {
        reads++;
        if (failure === "timeout") return new Promise(() => {});
        if (failure === "network") return Promise.reject(new Error("offline"));
        return Promise.resolve(new Response("", { status: failure }));
      },
    });
    await time.advance(0);
    assert.equal(reads, 1);
    await time.advance(failure === "timeout" ? 15000 : 0);
    await time.advance(999);
    assert.equal(reads, 1);
    await time.advance(1);
    assert.equal(reads, 2);
    await time.advance(failure === "timeout" ? 15000 : 0);
    await time.advance(1999);
    assert.equal(reads, 2);
    await time.advance(1);
    assert.equal(reads, 3);
    await time.advance(failure === "timeout" ? 15000 : 0);
    assert.ok(
      dom.window.document.querySelector("[data-user-gadgets-view] button"),
    );
    app.stop();
    dom.window.close();
  });

for (const [retryAfter, delay] of [
  ["5", 5000],
  ["Thu, 01 Jan 1970 00:00:10 GMT", 10000],
  ["invalid", 60000],
  [null, 60000],
])
  test(`429 冷却 ${retryAfter}`, async () => {
    const dom = new JSDOM(host, { url: "https://bgm.tv/user/alice#gadgets" });
    dom.window.scrollTo = () => {};
    const time = fakeTime();
    let reads = 0;
    const app = startApp({
      window: dom.window,
      timers: time,
      now: time.now,
      fetch: async () => {
        reads++;
        return reads === 1
          ? new Response("", {
              status: 429,
              headers: retryAfter ? { "Retry-After": retryAfter } : {},
            })
          : new Response(garage());
      },
    });
    await time.advance(0);
    const d = dom.window.document;
    d.querySelector("button").click();
    assert.equal(reads, 1);
    dom.window.location.hash = "";
    dom.window.dispatchEvent(new dom.window.HashChangeEvent("hashchange"));
    await time.advance(0);
    dom.window.location.hash = "#gadgets";
    dom.window.dispatchEvent(new dom.window.HashChangeEvent("hashchange"));
    await time.advance(0);
    d.querySelector("button").click();
    assert.equal(reads, 1);
    await time.advance(delay);
    assert.equal(reads, 1);
    d.querySelector("button").click();
    await time.advance(0);
    assert.equal(reads, 2);
    assert.equal(d.querySelectorAll("[data-user-gadgets-item]").length, 1);
    app.stop();
    dom.window.close();
  });
