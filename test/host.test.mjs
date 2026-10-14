import { test } from "node:test";
import assert from "node:assert/strict";
import { startApp } from "../src/entry.mjs";
import { garage, settle, setup } from "./support/fixtures.mjs";

test("缺 footer 时不读取，同 hash 可以重试挂载", async () => {
  let reads = 0;
  const { d, w, app } = setup("https://bgm.tv/user/alice#gadgets", async () => {
    reads++;
    return new Response(garage());
  });
  const footer = d.querySelector("#footer");
  footer.remove();
  await settle();
  assert.equal(reads, 0);
  assert.match(d.querySelector('[role="alert"]').textContent, /footer/);
  d.querySelector(".mainWrapper").append(footer);
  d.querySelector("[data-user-gadgets-link] a").click();
  await settle();
  assert.equal(reads, 1);
  assert.ok(d.querySelector("[data-user-gadgets-view]"));
  app.stop();
  w.close();
});

test("宿主外部属性、标题与焦点修改优先，删除节点不会复活", async () => {
  const { d, w, app } = setup();
  const original = d.querySelector("#original");
  original.querySelector("input").focus();
  d.querySelector("[data-user-gadgets-link] a").click();
  await settle();
  original.setAttribute("data-user-gadgets-hidden", "external");
  d.title = "外部标题";
  d.querySelector("#footer").tabIndex = 0;
  d.querySelector("#footer").focus();
  original.querySelector("input").remove();
  w.location.hash = "";
  await settle();
  assert.equal(original.getAttribute("data-user-gadgets-hidden"), "external");
  assert.equal(d.title, "外部标题");
  assert.equal(d.activeElement.id, "footer");
  assert.equal(original.children.length, 0);
  assert.equal(d.querySelector("[data-user-gadgets-style]"), null);
  app.stop();
  w.close();
});

for (const origin of [
  "https://bgm.tv",
  "https://bangumi.tv",
  "https://chii.in",
]) {
  for (const path of [
    "/user/alice",
    "/user/alice/blog/12",
    "/user/alice/index",
    "/user/alice/friends",
    "/user/alice/rev_friends",
    "/user/alice/timeline",
    "/user/alice/mono",
    "/user/alice/groups",
    "/user/alice/wiki",
    "/anime/list/alice/collect",
    "/book/list/alice/wish",
    "/music/list/alice/do",
    "/game/list/alice/on_hold",
    "/real/list/alice/dropped",
  ]) {
    test(`支持入口 ${origin}${path}`, () => {
      const { d, w, app } = setup(origin + path);
      assert.equal(d.querySelectorAll("[data-user-gadgets-link]").length, 1);
      assert.equal(
        startApp({ window: w, fetch: async () => new Response(garage()) }),
        app,
      );
      app.stop();
      w.close();
    });
  }
}
for (const path of [
  "http://bgm.tv/user/alice",
  "https://example.com/user/alice",
  "https://bgm.tv/user/alice/doujin",
  "https://bgm.tv/user/alice/unknown",
  "https://bgm.tv/anime/list/alice/unknown",
]) {
  test(`范围外静默 ${path}`, async () => {
    let reads = 0;
    const { d, w, app } = setup(path + "#gadgets", async () => {
      reads++;
      return new Response(garage());
    });
    await settle();
    assert.equal(reads, 0);
    assert.equal(d.querySelector("[data-user-gadgets-link]"), null);
    assert.equal(d.querySelector('[role="alert"]'), null);
    app.stop();
    w.close();
  });
}

test("身份冲突阻断，不回退登录查看者", async () => {
  let reads = 0;
  const { d, w, app } = setup("https://bgm.tv/user/other#gadgets", async () => {
    reads++;
    return new Response(garage());
  });
  await settle();
  assert.match(d.querySelector('[role="alert"]').textContent, /身份冲突/);
  assert.equal(reads, 0);
  app.stop();
  w.close();
});

test("只剩 footer、没有可靠正文时不挂载也不读取", async () => {
  let reads = 0;
  const { d, w, app } = setup("https://bgm.tv/user/alice#gadgets", async () => {
    reads++;
    return new Response(garage());
  });
  d.querySelector("#original").remove();
  await settle();
  assert.equal(reads, 0);
  assert.equal(d.querySelector("[data-user-gadgets-view]"), null);
  assert.match(d.querySelector('[role="alert"]').textContent, /正文/);
  app.stop();
  w.close();
});

test("外部无关 class 保留但组件 focus 清理、原导航 focus 恢复", async () => {
  const { d, w, app } = setup("https://bgm.tv/user/alice#gadgets");
  await settle();
  const link = d.querySelector("[data-user-gadgets-link] a");
  const home = d.querySelector('.navTabs a[href="/user/alice"]');
  link.classList.add("external");
  home.classList.add("external-home");
  w.location.hash = "";
  await settle();
  assert.equal(link.classList.contains("focus"), false);
  assert.equal(link.classList.contains("external"), true);
  assert.equal(home.classList.contains("focus"), true);
  assert.equal(home.classList.contains("external-home"), true);
  app.stop();
  w.close();
});
