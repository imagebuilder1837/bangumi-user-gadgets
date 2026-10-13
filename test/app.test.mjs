import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
import { startApp } from "../src/app.mjs";

const host = `<div id="wrapperNeue"><div id="headerProfile"><h1><span class="name"><a href="/user/alice">同名</a></span></h1><div class="navTabsWrapper"><ul class="navTabs"><li><a href="/user/alice" class="focus">首页</a></li><li><a href="/user/alice/blog">日志</a></li><li><a href="/user/alice/groups">小组</a></li></ul></div><div class="navSubTabsWrapper"><ul class="navSubTabs"></ul></div></div><div class="mainWrapper"><div id="original"><input></div><div id="footer">footer</div></div></div>`;
const card = (id = "31", author = "alice") =>
  `<li id="item_${id}"><span class="avatar"><a href="/dev/app/${id}"><img src="/img/no_icon_gadget.png"></a></span><span class="info"><a class="btnToggleGadget" href="/dev/app/${id}/enable?gh=REDACTED">启用</a><h3><a class="title" href="/dev/app/${id}">评分显示优化</a></h3><span class="tags">功能增强 评分与统计 UI</span><span class="tip_i"><a href="/user/${author}">同名</a></span><span class="attr_collects">21014</span><span class="attr_timestamp">2018-2-26 19:21</span><p class="desc">第一行\n<a href="https://bgm.tv/group/topic/345367">讨论</a><script>window.bad=true</script></p></span></li>`;
const garage = (cards = card()) =>
  `<div id="columnSubjectBrowserA"><div id="timeline"><h2>组件格纳库</h2><ul class="gadgetList list_all">${cards}</ul></div></div><div class="recommend">${card("99")}</div><script>var tagCategories = [{"name":"功能增强","subCategories":["评分与统计"]}];</script>`;
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
function fakeTime() {
  let clock = 0,
    id = 0;
  const jobs = new Map();
  return {
    now: () => clock,
    setTimeout(fn, ms) {
      jobs.set(++id, { fn, at: clock + ms });
      return id;
    },
    clearTimeout(key) {
      jobs.delete(key);
    },
    async advance(ms) {
      const end = clock + ms;
      for (;;) {
        const next = [...jobs]
          .filter(([, j]) => j.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        clock = next[1].at;
        jobs.delete(next[0]);
        next[1].fn();
        for (let i = 0; i < 15; i++) await Promise.resolve();
      }
      clock = end;
      for (let i = 0; i < 15; i++) await Promise.resolve();
    },
  };
}
function setup(
  url = "https://bgm.tv/user/alice",
  fetch = async () => new Response(garage()),
) {
  const dom = new JSDOM(host, { url });
  dom.window.scrollTo = () => {};
  const app = startApp({ window: dom.window, fetch });
  return { dom, app, d: dom.window.document, w: dom.window };
}
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

test("等价 URL 编码确认身份，数字与用户名不归并", async () => {
  const { d, w, app } = setup(
    "https://bgm.tv/user/%61lice#gadgets",
    async () => new Response(garage(card("31", "%61lice") + card("32", "123"))),
  );
  await settle();
  assert.equal(d.querySelectorAll("[data-user-gadgets-item]").length, 1);
  app.stop();
  w.close();
});

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

test("空作者显示格纳库限定的空结果", async () => {
  const { d, w, app } = setup(
    "https://bgm.tv/user/alice#gadgets",
    async () => new Response(garage(card("31", "other"))),
  );
  await settle();
  assert.match(
    d.querySelector("[data-user-gadgets-view]").textContent,
    /格纳库中未找到该用户开发的组件/,
  );
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
