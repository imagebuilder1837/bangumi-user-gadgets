import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFile } from "node:fs/promises";
import { startApp } from "../src/entry.mjs";
import { readGarage, toggleGadget } from "../src/garage.mjs";
import {
  host,
  card,
  garage,
  settle,
  fakeTime,
  setup,
} from "./support/fixtures.mjs";

const savedHTML = await readFile(
  new URL("./fixtures/garage.html", import.meta.url),
  "utf8",
);

async function readSample(html = savedHTML) {
  const dom = new JSDOM("");
  try {
    return await readGarage(
      {
        window: dom.window,
        timers: dom.window,
        now: () => 0,
        fetch: async (url, options) => {
          assert.equal(url, "https://bgm.tv/dev/garage");
          assert.equal(options.credentials, "same-origin");
          return new Response(html);
        },
      },
      "https://bgm.tv",
    );
  } finally {
    dom.window.close();
  }
}

test("浏览器保存页裁剪样本只读取主列表，解析同名不同作者及完整字段", async () => {
  const { items } = await readSample();
  assert.deepEqual(
    items.map((item) => [item.id, item.title, item.author, item.collects]),
    [
      ["31", "评分显示优化", "alice", 21006],
      ["1143", "TinyGrail Exchange Plugin", "other", 10035],
      ["1098", "[已弃用]在吐槽里显示bgm表情", "123", 6417],
    ],
  );
  assert.deepEqual(
    items.map((item) => item.authorName),
    ["同名", "同名", "同名"],
  );
  const first = items[0];
  assert.equal(first.href, "https://bgm.tv/dev/app/31");
  assert.equal(first.authorHref, "https://bgm.tv/user/alice");
  assert.equal(first.icon, "https://bgm.tv/img/no_icon_gadget.png");
  assert.equal(first.action, "https://bgm.tv/dev/app/31/enable?gh=REDACTED");
  assert.deepEqual(first.created, {
    text: "2018-2-26 19:21",
    value: Date.UTC(2018, 1, 26, 19, 21),
  });
  assert.deepEqual(first.updated, {
    text: "2020-4-4 10:30",
    value: Date.UTC(2020, 3, 4, 10, 30),
  });
  assert.deepEqual(
    items.map((item) => item.tags),
    [
      ["功能增强", "评分与统计", "评分", "统计", "UI"],
      ["小圣杯", "综合辅助", "交易", "UI"],
      ["社交互动", "表情与投票", "表情", "UI"],
    ],
  );
  const description = first.description.map((part) => part.text).join("");
  assert.match(description, /标准差与争议度\n争议度/);
  assert.match(
    description,
    /\n\n组件讨论页：https:\/\/bgm\.tv\/rakuen\/topic\/group\/345367/,
  );
});

test("浏览器保存页的 Unicode 转义分类数据保留完整主子分类", async () => {
  const { categories } = await readSample();
  assert.deepEqual(categories, [
    {
      name: "功能增强",
      subCategories: [
        "列表管理",
        "搜索与发现",
        "目录与标签",
        "评分与统计",
        "进度管理",
        "编辑器",
        "外部链接",
      ],
    },
    { name: "工具", subCategories: ["娱乐"] },
    {
      name: "界面优化",
      subCategories: [
        "交互体验",
        "导航",
        "显示增强",
        "样式与布局",
        "移动端优化",
      ],
    },
    {
      name: "社交互动",
      subCategories: [
        "好友与用户",
        "时间线",
        "表情与投票",
        "讨论与评论",
        "内容分享",
      ],
    },
    {
      name: "隐私与过滤",
      subCategories: ["内容屏蔽", "剧透防护", "隐私保护", "数据与导出"],
    },
    { name: "维基编辑", subCategories: ["批量操作", "编辑辅助"] },
    { name: "小圣杯", subCategories: ["数据与分析", "综合辅助"] },
  ]);
});

test("浏览器加工的显示标签不覆盖原始隐藏标签，内联脚本不执行", async () => {
  const baseline = await readSample();
  const dom = new JSDOM(savedHTML);
  try {
    for (const node of dom.window.document.querySelectorAll(".item-tags"))
      node.textContent = "加工后错误标签";
    const script = dom.window.document.createElement("script");
    script.textContent =
      'throw new Error("must not execute saved page scripts")';
    dom.window.document.body.append(script);
    assert.deepEqual(await readSample(dom.serialize()), baseline);
  } finally {
    dom.window.close();
  }
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

test("读取正文也受 15 秒超时限制，旧正文迟到不覆盖新尝试", async (t) => {
  const dom = new JSDOM("");
  t.after(() => dom.window.close());
  const time = fakeTime(),
    signals = [];
  let finishOldBody;
  const task = readGarage(
    {
      window: dom.window,
      timers: time,
      now: time.now,
      fetch: async (_, { signal }) => {
        signals.push(signal);
        return signals.length === 1
          ? {
              ok: true,
              text: () =>
                new Promise((resolve) => {
                  finishOldBody = resolve;
                }),
            }
          : new Response(garage(card("32")));
      },
    },
    "https://bgm.tv",
  );
  await time.advance(0);
  await time.advance(14999);
  assert.equal(signals[0].aborted, false);
  await time.advance(1);
  assert.equal(signals[0].aborted, true);
  await time.advance(1000);
  const result = await task;
  assert.deepEqual(
    result.items.map((item) => item.id),
    ["32"],
  );
  finishOldBody(garage(card("31")));
  await time.advance(15000);
  assert.equal(signals.length, 2);
  assert.equal(signals[1].aborted, false);
  assert.deepEqual(
    result.items.map((item) => item.id),
    ["32"],
  );
});

for (const kind of ["read", "action"])
  for (const outcome of ["success", "failure"])
    test(`${kind} ${outcome} 及时清除超时定时器`, async (t) => {
      const dom = new JSDOM("");
      t.after(() => dom.window.close());
      const time = fakeTime(),
        active = new Set();
      const timers = {
        setTimeout(fn, ms) {
          const id = time.setTimeout(fn, ms);
          active.add(id);
          return id;
        },
        clearTimeout(id) {
          active.delete(id);
          time.clearTimeout(id);
        },
      };
      let signal;
      const context = {
        window: dom.window,
        timers,
        now: time.now,
        fetch: async (_, options) => {
          signal = options.signal;
          if (kind === "action" && outcome === "failure")
            throw new Error("offline");
          return outcome === "success"
            ? new Response(garage())
            : new Response("", { status: 403 });
        },
      };
      if (kind === "read") {
        const task = readGarage(context, "https://bgm.tv");
        if (outcome === "failure") await assert.rejects(task, /403/);
        else assert.equal((await task).items.length, 1);
      } else {
        assert.equal(
          await toggleGadget(
            context,
            "https://bgm.tv/dev/app/31/enable?gh=REDACTED",
          ),
          outcome === "success",
        );
      }
      assert.equal(active.size, 0);
      await time.advance(15000);
      assert.equal(signal.aborted, false);
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
