import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { host, card, garage, fakeTime, settle } from "./support/fixtures.mjs";
import {
  viewQuery,
  filterOption,
  visibleItems,
  setSearchValue,
} from "./support/interactions.mjs";

const bundle = readFileSync(
  new URL("../src/index.user.js", import.meta.url),
  "utf8",
);
const sample = garage(
  card("31").replace("评分与统计 UI", "评分与统计 UI 共用 新标签") +
    card("32")
      .replace("评分与统计 UI", "评分与统计 UI 独有")
      .replace("21014", "2") +
    card("33")
      .replace("评分与统计 UI", "评分与统计 共用")
      .replace("21014", "2") +
    card("34").replace("功能增强 评分与统计 UI", "未知").replace("21014", "") +
    card("35", "bob"),
);

function install(
  t,
  url = "https://bgm.tv/user/alice",
  responses = [new Response(sample)],
) {
  const dom = new JSDOM(host, { url, runScripts: "outside-only" });
  const w = dom.window,
    d = w.document,
    time = fakeTime(),
    requests = [];
  w.scrollTo = () => {};
  w.setTimeout = time.setTimeout;
  w.clearTimeout = time.clearTimeout;
  w.Date.now = time.now;
  w.fetch = (url, options) => {
    const request = { url, options };
    requests.push(request);
    if (url.endsWith("/dev/garage")) return Promise.resolve(responses.shift());
    return new Promise((resolve, reject) =>
      Object.assign(request, { resolve, reject }),
    );
  };
  w.eval(bundle);
  t.after(() => w.close());
  // Deliberately synthetic hashchange: tests application task boundaries, not native browser timing.
  const route = async (hash) => {
    w.history.replaceState(null, "", hash || w.location.pathname);
    w.dispatchEvent(new w.HashChangeEvent("hashchange"));
    await time.advance(0);
  };
  const query = (selector) => viewQuery(d, selector);
  const button = (text) =>
    [...d.querySelectorAll("[data-user-gadgets-view] button")].find(
      (n) => n.textContent === text,
    );
  const option = (name, type = "radio") => filterOption(d, name, type);
  const search = (value, key = "Enter") => {
    const input = setSearchValue(d, value);
    input.dispatchEvent(new w.KeyboardEvent("keydown", { key, bubbles: true }));
  };
  const visible = () => visibleItems(d);
  return {
    w,
    d,
    time,
    requests,
    route,
    query,
    button,
    option,
    search,
    visible,
  };
}

test("安装产物普通初始化提示身份冲突且不读取或接管", async (t) => {
  const { d, requests } = install(t, "https://bgm.tv/user/other");
  assert.match(d.querySelector('[role="alert"]').textContent, /身份冲突/);
  assert.equal(d.querySelectorAll("[data-user-gadgets-error]").length, 1);
  assert.equal(d.querySelector("[data-user-gadgets-link]"), null);
  assert.equal(d.querySelector("[data-user-gadgets-view]"), null);
  assert.equal(d.querySelector("[data-user-gadgets-hidden]"), null);
  assert.equal(requests.length, 0);
});

test("安装产物子分类路径高亮与关联区位置不扩大筛选范围", async (t) => {
  const { d, route, option, query, visible, button } = install(t);
  await route("#gadgets");
  option("评分与统计").click();
  assert.deepEqual(visible(), ["31", "32", "33"]);
  const badges = query('[data-user-gadgets-item="31"] .item-tags').children;
  assert.equal(badges[0].classList.contains("highlighted"), true);
  assert.equal(badges[1].classList.contains("highlighted"), true);
  assert.equal(badges[0].getAttribute("aria-pressed"), "false");
  assert.equal(option("功能增强").checked, false);
  const related = query(".related-tags-container");
  assert.equal(
    related.parentElement,
    option("功能增强").closest(".main-category"),
  );
  assert.equal(related.querySelector("h3"), null);
  assert.equal(button("重置").tagName, "BUTTON");
  button("重置").click();
  assert.equal(related.hidden, true);
  assert.equal(
    d.querySelector('[data-user-gadgets-item="31"] .badge_tag.highlighted'),
    null,
  );
});

for (const origin of [
  "https://bgm.tv",
  "https://bangumi.tv",
  "https://chii.in",
])
  for (const path of ["/user/alice", "/anime/list/alice/collect"])
    test(`安装产物完整流程及同源隔离 ${origin}${path}`, async (t) => {
      const {
        w,
        d,
        time,
        requests,
        route,
        query,
        button,
        option,
        search,
        visible,
      } = install(t, origin + path);
      assert.equal(requests.length, 0);
      await route("#gadgets");
      assert.deepEqual(visible(), ["31", "32", "33", "34"]);
      const nodes = [...d.querySelectorAll("[data-user-gadgets-item]")];
      button("从少到多").click();
      assert.deepEqual(visible(), ["32", "33", "31", "34"]);
      option("功能增强").click();
      const frequencies = () =>
        [...d.querySelectorAll(".related-tags-wrapper label")].map(
          (n) => n.textContent,
        );
      const fixed = frequencies();
      option("UI", "checkbox").click();
      option("共用", "checkbox").click();
      assert.deepEqual(visible(), ["31"]);
      search("评分　讨论");
      assert.deepEqual(visible(), ["31"]);
      assert.deepEqual(frequencies(), fixed);
      assert.equal(option("独有", "checkbox").disabled, true);
      search("独有");
      assert.deepEqual(visible(), []);
      assert.equal(option("UI", "checkbox").disabled, false);
      assert.deepEqual(frequencies(), fixed);
      search("评分　讨论");
      assert.ok(query('[data-user-gadgets-item="31"] mark'));
      button("从多到少").click();
      assert.deepEqual(visible(), ["31"]);
      // New card tag replaces all selected tags even within the same category.
      query('[data-user-gadgets-item="31"] .badge_tag:last-child').click();
      assert.equal(option("UI", "checkbox").checked, false);
      assert.equal(option("共用", "checkbox").checked, false);
      assert.equal(option("新标签", "checkbox").checked, true);
      query('[data-user-gadgets-item="31"] .badge_tag:last-child').click();
      assert.equal(option("新标签", "checkbox").checked, false);
      option("UI", "checkbox").click();
      search("不存在");
      assert.deepEqual(visible(), []);
      assert.match(query(".ug-list").textContent, /没有符合当前条件的组件/);
      assert.equal(option("UI", "checkbox").disabled, false);
      search("", "Escape");
      assert.equal(option("UI", "checkbox").checked, true);
      assert.deepEqual(visible(), ["31", "32"]);
      search("评分 讨论");
      button("重置").click();
      assert.equal(query('[aria-label="搜索组件"]').value, "评分 讨论");
      assert.deepEqual(visible(), ["31", "32", "33", "34"]);
      assert.ok(nodes.every((n) => n.isConnected));
      search("独有");
      option("功能增强").click();
      assert.equal(option("共用", "checkbox").disabled, true);
      assert.equal(option("UI", "checkbox").disabled, false);
      assert.deepEqual(frequencies(), fixed);
      search("评分 讨论");
      button("重置").click();
      assert.equal(w.location.pathname, path);
      assert.equal(w.localStorage.length, 0);
      await route("");
      assert.equal(d.querySelector("[data-user-gadgets-view]"), null);
      assert.equal(
        d.querySelector("#original").hasAttribute("data-user-gadgets-hidden"),
        false,
      );
      for (let i = 0; i < 3; i++) {
        await route("#gadgets");
        assert.equal(query('[aria-label="搜索组件"]').value, "评分 讨论");
        assert.equal(button("从多到少").getAttribute("aria-pressed"), "true");
        assert.equal(d.querySelectorAll("[data-user-gadgets-style]").length, 1);
        const ids = [...d.querySelectorAll("[id]")].map((n) => n.id);
        assert.equal(new Set(ids).size, ids.length);
        await route("");
      }
      await time.advance(200);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, origin + "/dev/garage");
    });

test("安装产物组合动作：隐藏、高亮、排序、重入、超时重试与旧计时器", async (t) => {
  const { d, time, requests, route, query, button, option, search, visible } =
    install(t);
  await route("#gadgets");
  const action = () => query('[data-user-gadgets-item="31"] .btnToggleGadget');
  const old = action();
  old.click();
  button("从少到多").click();
  option("功能增强").click();
  option("UI", "checkbox").click();
  search("评分 讨论");
  assert.equal(action(), old);
  assert.ok(query('[data-user-gadgets-item="31"] mark'));
  search("不存在");
  assert.equal(old.closest("li").hidden, true);
  await route("");
  await time.advance(15000);
  assert.equal(d.querySelector("[data-user-gadgets-view]"), null);
  await route("#gadgets");
  assert.equal(action().textContent, "出错了");
  assert.deepEqual(visible(), []);
  action().click();
  action().click();
  assert.equal(requests.length, 3);
  requests[1].resolve({ ok: true });
  await time.advance(2000);
  assert.equal(action().textContent, "启用中…");
  requests[2].resolve({ ok: true });
  await time.advance(0);
  assert.equal(action().textContent, "停用");
  assert.equal(
    query('[data-user-gadgets-item="31"] .attr_collects').textContent,
    "21014",
  );
  search("", "Escape");
  assert.deepEqual(visible(), ["32", "31"]);
  assert.equal(old.textContent, "启用中…");
  await route("");
  await route("#gadgets");
  action().click();
  assert.equal(requests.length, 4); // No accumulated click handlers or reads.
  requests[3].resolve({ ok: true });
  await time.advance(0);
  assert.equal(action().textContent, "启用");
});

test("安装产物导航中读取重试、429 冷却、解析失败及分类降级", async (t) => {
  const degraded = sample.replace(
    /var tagCategories = [\s\S]*?;<\/script>/,
    "var tagCategories = invalid;</script>",
  );
  const { d, time, requests, route, query, button, search, visible } = install(
    t,
    undefined,
    [
      new Response("", { status: 503 }),
      new Response("", { status: 429, headers: { "Retry-After": "5" } }),
      new Response("challenge"),
      new Response(degraded),
    ],
  );
  await route("#gadgets");
  await route("");
  await time.advance(1000);
  assert.equal(requests.length, 2);
  assert.equal(d.querySelector("[data-user-gadgets-view]"), null);
  await route("#gadgets");
  query("button").click();
  assert.equal(requests.length, 2);
  await route("");
  await time.advance(5000);
  await route("#gadgets");
  assert.equal(requests.length, 2);
  query("button").click();
  await time.advance(0);
  assert.equal(requests.length, 3);
  assert.ok(query('[role="status"]'));
  assert.doesNotMatch(query('[role="status"]').textContent, /未找到该用户开发/);
  await route("");
  await route("#gadgets");
  assert.equal(requests.length, 3);
  query("button").click();
  await time.advance(0);
  assert.match(query(".ug-tools").textContent, /分类配置暂不可用/);
  search("UI 讨论");
  button("从少到多").click();
  assert.deepEqual(visible(), ["32", "31"]);
  assert.equal(requests.length, 4);
});

test("安装产物切换目标隔离迟到读取，退出尊重外部宿主修改", async (t) => {
  let finishAlice;
  const delayed = new Promise((resolve) => {
    finishAlice = resolve;
  });
  const { w, d, time, requests, route, query, search, visible } = install(
    t,
    undefined,
    [delayed, new Response(sample)],
  );
  await route("#gadgets");
  await route("");
  const navigate = async (user) => {
    for (const link of d.querySelectorAll("#headerProfile a[href]")) {
      if (!link.hash && link.pathname.startsWith("/user/"))
        link.pathname = link.pathname.replace(/\/user\/[^/]+/, `/user/${user}`);
    }
    w.history.replaceState(null, "", `/user/${user}`);
    await route("#gadgets");
  };
  await navigate("bob");
  assert.deepEqual(visible(), ["35"]);
  search("不存在");
  finishAlice(new Response(sample));
  await time.advance(0);
  assert.deepEqual(visible(), []);
  assert.equal(query('[aria-label="搜索组件"]').value, "不存在");
  await route("");
  await navigate("alice");
  assert.deepEqual(visible(), ["31", "32", "33", "34"]);
  const original = d.querySelector("#original");
  original.setAttribute("data-user-gadgets-hidden", "external");
  original.querySelector("input").remove();
  d.title = "外部标题";
  d.querySelector("#footer").tabIndex = 0;
  d.querySelector("#footer").focus();
  await route("");
  assert.equal(d.title, "外部标题");
  assert.equal(d.activeElement.id, "footer");
  assert.equal(original.getAttribute("data-user-gadgets-hidden"), "external");
  assert.equal(original.children.length, 0);
  assert.equal(d.querySelector("[data-user-gadgets-style]"), null);
  original.removeAttribute("data-user-gadgets-hidden");
  await navigate("bob");
  assert.equal(query('[aria-label="搜索组件"]').value, "不存在");
  assert.deepEqual(visible(), []);
  assert.equal(requests.length, 2);
});

for (const order of ["posts-first", "gadgets-first"])
  for (const initialHash of ["#posts", "#gadgets"])
    test(`安装产物与独立虚拟页 ${order} ${initialHash} 深链、失败重试、快速导航及历史`, async (t) => {
      const dom = new JSDOM(host, {
        url: `https://bgm.tv/user/alice${initialHash}`,
        runScripts: "outside-only",
      });
      const w = dom.window,
        d = w.document;
      t.after(() => w.close());
      let scrollY = 40;
      const scrolls = [];
      Object.defineProperty(w, "scrollY", { get: () => scrollY });
      w.scrollTo = (x, y) => {
        scrolls.push([x, y]);
        scrollY = y;
      };
      const originalInput = d.querySelector("#original input");
      originalInput.focus();
      const postsLink = d.createElement("a");
      postsLink.href = "#posts";
      postsLink.textContent = "帖子";
      const postsEntry = d.createElement("li");
      postsEntry.append(postsLink);
      d.querySelector(".navTabs").append(postsEntry);
      let posts = null,
        reads = 0,
        release = null;
      // Local stand-in, not the other project's implementation or real-browser evidence.
      const routePosts = () => {
        if (w.location.hash !== "#posts" && posts) {
          release();
          posts.remove();
          posts = null;
        }
        w.setTimeout(() => {
          if (w.location.hash !== "#posts" || posts) return;
          const original = d.querySelector("#original"),
            link = d.querySelector('.navTabs a[href="/user/alice"]');
          const title = d.title,
            previousFocus = d.activeElement,
            scroll = w.scrollY;
          original.hidden = true;
          link.classList.remove("focus");
          postsLink.classList.add("focus");
          d.title = "帖子标题";
          posts = d.createElement("section");
          posts.dataset.userTopicsView = "";
          posts.tabIndex = -1;
          posts.append(d.createElement("input"));
          d.querySelector("#footer").before(posts);
          if (previousFocus === originalInput) posts.focus();
          release = () => {
            original.hidden = false;
            postsLink.classList.remove("focus");
            link.classList.add("focus");
            d.title = title;
            if (posts.contains(d.activeElement) || d.activeElement === d.body)
              previousFocus.focus();
            w.scrollTo(0, scroll);
          };
        }, 0);
      };
      const loadPosts = () => {
        w.addEventListener("hashchange", routePosts, true);
        routePosts();
      };
      w.fetch = async () => {
        reads++;
        return new Response(sample);
      };
      if (order === "posts-first") loadPosts();
      w.eval(bundle);
      if (order === "gadgets-first") loadPosts();
      const wait = async (predicate) => {
        for (let i = 0; i < 100 && !predicate(); i++) await settle();
        assert.ok(predicate());
      };
      const assertActive = (hash) => {
        const root =
          hash === "#posts"
            ? posts
            : d.querySelector("[data-user-gadgets-view]");
        assert.equal(d.activeElement, root);
        assert.equal(w.scrollY, 40);
        assert.deepEqual(
          [...d.querySelectorAll(".navTabs a.focus")].map((n) => n.hash),
          [hash],
        );
      };
      if (initialHash === "#gadgets") {
        await wait(() => !!d.querySelector("[data-user-gadgets-item]"));
        assertActive("#gadgets");
        d.querySelector('[aria-label="搜索组件"]').focus();
        w.scrollTo(0, 111);
        w.location.hash = "#posts";
      }
      await wait(() => !!posts);
      assertActive("#posts");
      posts.querySelector("input").focus();
      w.scrollTo(0, 222);
      const footer = d.querySelector("#footer");
      footer.remove();
      w.location.hash = "#gadgets";
      await wait(() => !!d.querySelector("[data-user-gadgets-error]"));
      assert.equal(reads, initialHash === "#gadgets" ? 1 : 0);
      assert.equal(d.activeElement, originalInput);
      assert.equal(w.scrollY, 40);
      d.querySelector(".mainWrapper").append(footer);
      d.querySelector("[data-user-gadgets-link] a").click();
      await wait(() => !!d.querySelector("[data-user-gadgets-item]"));
      assert.equal(d.title, "同名 的组件");
      assertActive("#gadgets");
      d.querySelector('[aria-label="搜索组件"]').focus();
      w.scrollTo(0, 333);
      assert.equal(
        d
          .querySelector("[data-user-gadgets-view]")
          .closest("[hidden], [data-user-gadgets-hidden]"),
        null,
      );
      w.location.hash = "#posts";
      await wait(() => !!posts);
      assert.equal(d.title, "帖子标题");
      assertActive("#posts");
      posts.querySelector("input").focus();
      w.scrollTo(0, 444);
      assert.equal(posts.closest("[data-user-gadgets-hidden]"), null);
      w.history.back();
      await wait(
        () =>
          w.location.hash === "#gadgets" &&
          !!d.querySelector("[data-user-gadgets-item]"),
      );
      assert.equal(d.title, "同名 的组件");
      assertActive("#gadgets");
      d.querySelector('[aria-label="搜索组件"]').focus();
      w.scrollTo(0, 555);
      w.history.forward();
      await wait(() => w.location.hash === "#posts" && !!posts);
      assertActive("#posts");
      // A later external focus transfer must not be replaced by an old snapshot.
      footer.tabIndex = 0;
      footer.focus();
      w.scrollTo(0, 666);
      w.location.hash = "#gadgets";
      w.location.hash = "#posts";
      w.location.hash = "";
      await wait(() => !posts && !d.querySelector("[data-user-gadgets-view]"));
      await settle();
      assert.equal(d.title, "");
      assert.equal(d.activeElement, footer);
      assert.equal(w.scrollY, 40);
      assert.ok(scrolls.filter(([, y]) => y === 40).length >= 4);
      assert.equal(d.querySelector("#original").hidden, false);
      assert.ok(
        d
          .querySelector('.navTabs a[href="/user/alice"]')
          .classList.contains("focus"),
      );
      assert.equal(reads, 1);
    });
