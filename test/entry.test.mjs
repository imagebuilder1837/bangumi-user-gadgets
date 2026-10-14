import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { startApp } from "../src/entry.mjs";
import { host, card, garage, settle, setup } from "./support/fixtures.mjs";

test("入口不读取，激活后精确匹配作者、安全显示，退出与重入复用", async () => {
  let reads = 0;
  const { d, w, app } = setup(undefined, async () => {
    reads++;
    return new Response(garage(card() + card("32", "other")));
  });
  assert.equal(reads, 0);
  const link = d.querySelector("[data-user-gadgets-link] a");
  assert.equal(link.parentElement.previousElementSibling.textContent, "小组");
  link.click();
  await settle();
  assert.equal(d.title, "同名 的组件");
  assert.equal(
    d.querySelectorAll("[data-user-gadgets-view] .gadgetList li").length,
    1,
  );
  assert.equal(
    d.querySelector("[data-user-gadgets-view] .btnToggleGadget"),
    null,
  );
  assert.equal(d.querySelector("[data-user-gadgets-view] script"), null);
  const original = d.querySelector("#original");
  w.location.hash = "";
  await settle();
  assert.equal(d.querySelector("[data-user-gadgets-view]"), null);
  assert.equal(d.querySelector("#original"), original);
  w.location.hash = "#gadgets";
  await settle();
  assert.equal(reads, 1);
  app.stop();
  w.close();
});

test("后台完成不重开，重入复用在途任务，新文档重新读取", async () => {
  let resolve,
    reads = 0;
  const fetch = () => {
    reads++;
    return new Promise((r) => {
      resolve = r;
    });
  };
  const { d, w, app } = setup("https://bgm.tv/user/alice#gadgets", fetch);
  await settle();
  assert.match(d.querySelector('[role="status"]').textContent, /正在加载组件/);
  w.location.hash = "";
  await settle();
  resolve(new Response(garage()));
  await settle();
  assert.equal(d.querySelector("[data-user-gadgets-view]"), null);
  w.location.hash = "#gadgets";
  await settle();
  assert.equal(reads, 1);
  app.stop();
  w.close();
  const other = setup("https://bgm.tv/user/alice#gadgets", async () => {
    reads++;
    return new Response(garage());
  });
  await settle();
  assert.equal(reads, 2);
  other.app.stop();
  other.w.close();
});

for (const order of ["posts-first", "gadgets-first"])
  test(`独立虚拟页 ${order} 原生 hashchange 双向切换`, async () => {
    const dom = new JSDOM(host, { url: "https://bgm.tv/user/alice" });
    const w = dom.window,
      d = w.document;
    w.scrollTo = () => {};
    let posts = null;
    const route = () => {
      if (w.location.hash !== "#posts") {
        posts?.remove();
        posts = null;
      }
      setTimeout(() => {
        if (w.location.hash === "#posts" && !posts) {
          posts = d.createElement("section");
          posts.dataset.userTopicsView = "";
          d.querySelector("#footer").before(posts);
        }
      }, 0);
    };
    if (order === "posts-first") w.addEventListener("hashchange", route, true);
    const app = startApp({
      window: w,
      fetch: async () => new Response(garage()),
    });
    if (order === "gadgets-first")
      w.addEventListener("hashchange", route, true);
    for (const hash of ["#posts", "#gadgets", "#posts", "#gadgets"]) {
      w.location.hash = hash;
      await settle();
      assert.equal(
        !!d.querySelector("[data-user-gadgets-view]"),
        hash === "#gadgets",
      );
      assert.equal(
        !!d.querySelector("[data-user-topics-view]"),
        hash === "#posts",
      );
    }
    w.location.hash = "#posts";
    w.location.hash = "#gadgets";
    w.location.hash = "";
    await settle();
    assert.equal(d.querySelector("[data-user-gadgets-view]"), null);
    w.removeEventListener("hashchange", route, true);
    app.stop();
    w.close();
  });
