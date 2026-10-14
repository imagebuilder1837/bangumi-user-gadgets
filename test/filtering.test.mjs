import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import {
  setup,
  garage,
  card,
  settle,
  fakeTime,
  host,
} from "./support/fixtures.mjs";
import { JSDOM } from "jsdom";
import { startApp } from "../src/entry.mjs";

const tagged = (id, tags, title = `组件${id}`, desc = "简介") =>
  card(id)
    .replace("功能增强 评分与统计 UI", tags)
    .replace("评分显示优化", title)
    .replace(/<p class="desc">[\s\S]*?<\/p>/, `<p class="desc">${desc}</p>`);
const html = () =>
  garage(
    [
      tagged(
        "1",
        "功能增强 评分与统计 UI UI 共用",
        "Alpha评分",
        '第一行 <a href="/group/topic/1">讨论</a>',
      ),
      tagged("2", "功能增强 无效 UI 界面优化"),
      tagged("3", "未知 评分与统计 共用"),
      tagged("4", ""),
      tagged("5", "界面优化 美化 共用"),
      tagged("6", "功能增强 评分与统计 独有"),
      tagged("7", "功能增强 评分与统计 他人").replace(
        "/user/alice",
        "/user/bob",
      ),
    ].join(""),
  ).replace(
    '"subCategories":["评分与统计"]}]',
    '"subCategories":["评分与统计","空子类"]},{"name":"界面优化","subCategories":["美化"]},{"name":"空主类","subCategories":[]}]',
  );
const root = (d) => d.querySelector("[data-user-gadgets-view]");
const visible = (d) =>
  [...root(d).querySelectorAll("[data-user-gadgets-item]")]
    .filter((n) => !n.hidden)
    .map((n) => n.dataset.userGadgetsItem);
const option = (d, text, type = "radio") =>
  [...root(d).querySelectorAll(`input[type=${type}]`)].find(
    (n) =>
      n.closest("label").querySelector(".ug-option-name").textContent === text,
  );
const count = (n) => n.closest("label").querySelector(".tag-count").textContent;
const search = (d) => root(d).querySelector('input[aria-label="搜索组件"]');
const enter = (w, d, value) => {
  const n = search(d);
  n.value = value;
  n.dispatchEvent(new w.Event("input"));
  n.dispatchEvent(
    new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
};
async function open(t, source = html()) {
  const ctx = setup(
    "https://bgm.tv/user/alice#gadgets",
    async () => new Response(source),
  );
  t.after(() => {
    ctx.app.stop();
    ctx.w.close();
  });
  await settle();
  return ctx;
}

test("搜索跨字段 AND、字面词与安全重叠高亮，保留节点和链接", async (t) => {
  const source = garage(
    tagged(
      "1",
      "功能增强 评分与统计 Alpha UI",
      "AbabaX &lt;img onerror=bad&gt;",
      '讨论 <a href="/group/topic/1">AlphaBeta</a><br>[-.*] &quot;word&quot; -no',
    ) + tagged("2", "功能增强 UI", "别的", "其他"),
  );
  const { d, w } = await open(t, source);
  const item = root(d).querySelector('[data-user-gadgets-item="1"]');
  const link = item.querySelector(".desc a");
  const title = item.querySelector("h3 a");
  const meta = item.querySelector(".tip_i");
  enter(w, d, "aba\u3000bax\tAlpha \n UI");
  assert.deepEqual(visible(d), ["1"]);
  assert.deepEqual(
    [...title.querySelectorAll("mark")].map((n) => n.textContent),
    ["AbabaX"],
  );
  assert.equal(link.textContent, "AlphaBeta");
  assert.equal(link.querySelector("mark").textContent, "Alpha");
  assert.equal(item.querySelector(".item-tags mark"), null);
  assert.deepEqual(
    [...item.querySelectorAll(".badge_tag.highlighted")].map(
      (n) => n.textContent,
    ),
    ["Alpha", "UI"],
  );
  assert.equal(item.querySelector(".desc a"), link);
  assert.equal(item.querySelector(".tip_i"), meta);
  assert.equal(item.querySelectorAll("mark mark").length, 0);
  enter(w, d, '[-.*] "word" -no');
  assert.deepEqual(visible(d), ["1"]);
  assert.equal(item.querySelector(".desc").querySelectorAll("mark").length, 3);
  enter(w, d, "<img");
  assert.equal(title.querySelector("mark").textContent, "<img");
  assert.equal(title.querySelector("img"), null);
  enter(w, d, "同名");
  assert.deepEqual(visible(d), []);
  enter(w, d, "  \u3000\t\n");
  assert.deepEqual(visible(d), ["1", "2"]);
  assert.equal(item.querySelectorAll("mark").length, 0);
  assert.equal(root(d).querySelector('[data-user-gadgets-item="1"]'), item);
});

test("卡片标签按角色定位、替换与取消；重置和重入保留搜索排序", async (t) => {
  const { d, w } = await open(t);
  const badge = (id, text) =>
    [
      ...root(d)
        .querySelector(`[data-user-gadgets-item="${id}"]`)
        .querySelectorAll(".badge_tag"),
    ].find((n) => n.textContent === text);
  const allNodes = [...root(d).querySelectorAll("[data-user-gadgets-item]")];
  let scrolls = 0;
  w.scrollTo = () => scrolls++;
  const url = w.location.href,
    history = w.history.length;
  option(d, "功能增强").click();
  option(d, "UI", "checkbox").click();
  option(d, "共用", "checkbox").click();
  badge("1", "UI").click();
  assert.equal(option(d, "UI", "checkbox").checked, false);
  assert.equal(option(d, "共用", "checkbox").checked, true);
  badge("1", "UI").click();
  assert.equal(option(d, "评分与统计").checked, true);
  assert.equal(option(d, "UI", "checkbox").checked, true);
  assert.equal(option(d, "共用", "checkbox").checked, false);
  option(d, "共用", "checkbox").click();
  badge("1", "功能增强").click();
  assert.equal(option(d, "功能增强").checked, true);
  assert.equal(option(d, "共用", "checkbox").checked, false);
  badge("2", "界面优化").click(); // ordinary tag sharing a category name
  assert.equal(option(d, "功能增强").checked, true);
  assert.equal(option(d, "界面优化", "checkbox").checked, true);
  assert.deepEqual(visible(d), ["2"]);
  badge("2", "无效").click(); // same category must replace, not accumulate
  assert.equal(option(d, "界面优化", "checkbox").checked, false);
  assert.equal(option(d, "无效", "checkbox").checked, true);
  badge("3", "评分与统计").click(); // not a category in this position
  assert.equal(option(d, "未分类").checked, true);
  assert.deepEqual(visible(d), ["3"]);
  assert.equal(count(option(d, "评分与统计", "checkbox")), "1");
  badge("3", "未知").dispatchEvent(
    new w.KeyboardEvent("keydown", { key: " ", bubbles: true }),
  );
  assert.equal(option(d, "未知", "checkbox").checked, true);
  assert.equal(option(d, "评分与统计", "checkbox").checked, false);
  enter(w, d, "未知");
  [...root(d).querySelectorAll(".ug-sort button")]
    .find((n) => n.textContent === "从少到多")
    .click();
  [...root(d).querySelectorAll("button")]
    .find((n) => n.textContent === "重置")
    .click();
  assert.equal(search(d).value, "未知");
  assert.deepEqual(visible(d), ["3"]);
  assert.equal(root(d).querySelectorAll("input[type=checkbox]").length, 0);
  badge("3", "未知").click();
  assert.equal(w.location.href, url);
  assert.equal(w.history.length, history);
  assert.equal(scrolls, 0);
  assert.ok(allNodes.every((n) => n.isConnected));
  w.location.hash = "";
  await settle();
  w.location.hash = "#gadgets";
  await settle();
  assert.equal(search(d).value, "未知");
  assert.equal(option(d, "未分类").checked, true);
  assert.equal(option(d, "未知", "checkbox").checked, true);
  assert.equal(
    [...root(d).querySelectorAll(".ug-sort button")]
      .find((n) => n.textContent === "从少到多")
      .getAttribute("aria-pressed"),
    "true",
  );
  search(d).dispatchEvent(
    new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  assert.equal(search(d).value, "");
  assert.equal(option(d, "未知", "checkbox").checked, true);
  option(d, "未分类").click();
  assert.deepEqual(visible(d), ["1", "2", "3", "4", "5", "6"]);
});

test("防抖、IME 取消旧提交、Enter/Escape 与退出清理不竞争", async (t) => {
  const dom = new JSDOM(host, { url: "https://bgm.tv/user/alice#gadgets" }),
    w = dom.window,
    d = w.document;
  w.scrollTo = () => {};
  const timers = fakeTime();
  let reads = 0;
  const app = startApp({
    window: w,
    timers,
    now: timers.now,
    fetch: async () => {
      reads++;
      return new Response(html());
    },
  });
  t.after(() => {
    app.stop();
    w.close();
  });
  await timers.advance(0);
  const input = search(d);
  const type = (value) => {
    input.value = value;
    input.dispatchEvent(new w.Event("input"));
  };
  type("不存在");
  await timers.advance(179);
  assert.equal(visible(d).length, 6);
  input.dispatchEvent(new w.CompositionEvent("compositionstart"));
  await timers.advance(1000);
  assert.equal(visible(d).length, 6);
  type("组词");
  input.dispatchEvent(
    new w.KeyboardEvent("keydown", { key: "Enter", isComposing: true }),
  );
  await timers.advance(1000);
  assert.equal(visible(d).length, 6);
  input.value = "评分";
  input.dispatchEvent(new w.CompositionEvent("compositionend"));
  await timers.advance(179);
  assert.equal(visible(d).length, 6);
  await timers.advance(1);
  assert.deepEqual(visible(d), ["1", "3", "6"]);
  type("UI");
  input.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter" }));
  assert.deepEqual(visible(d), ["1", "2"]);
  type("不存在");
  input.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape" }));
  await timers.advance(200);
  assert.equal(visible(d).length, 6);
  type("UI");
  await timers.advance(180);
  assert.deepEqual(visible(d), ["1", "2"]);
  type("不存在");
  w.history.replaceState(null, "", "/user/alice");
  w.dispatchEvent(new w.HashChangeEvent("hashchange"));
  await timers.advance(1000);
  assert.equal(root(d), null);
  w.history.replaceState(null, "", "/user/alice#gadgets");
  w.dispatchEvent(new w.HashChangeEvent("hashchange"));
  await timers.advance(0);
  assert.equal(search(d).value, "UI");
  assert.deepEqual(visible(d), ["1", "2"]);
  assert.equal(reads, 1);
});

test("仅主分类、错位与空标签不误归类，分类间同名标签频数重新显示", async (t) => {
  const source = garage(
    [
      tagged("1", "功能增强"),
      tagged("2", "功能增强 UI"),
      tagged("3", "功能增强 UI"),
      tagged("4", "界面优化 UI"),
      tagged("5", "其他 功能增强 评分与统计"),
      tagged("6", ""),
      tagged("7", "评分与统计 功能增强"),
    ].join(""),
  ).replace(
    '"subCategories":["评分与统计"]}]',
    '"subCategories":["评分与统计"]},{"name":"界面优化","subCategories":[]}]',
  );
  const { d } = await open(t, source);
  assert.equal(option(d, "评分与统计"), undefined);
  option(d, "功能增强").click();
  assert.deepEqual(visible(d), ["1", "2", "3"]);
  assert.equal(count(option(d, "UI", "checkbox")), "2");
  option(d, "界面优化").click();
  assert.deepEqual(visible(d), ["4"]);
  assert.equal(count(option(d, "UI", "checkbox")), "1");
  option(d, "未分类").click();
  assert.deepEqual(visible(d), ["5", "6", "7"]);
  assert.equal(count(option(d, "功能增强", "checkbox")), "2");
  assert.equal(count(option(d, "评分与统计", "checkbox")), "2");
});

test("分类损坏局部降级，搜索与排序仍可用且不执行配置脚本", async (t) => {
  const source = html().replace(
    /var tagCategories = [\s\S]*?;<\/script>/,
    "var tagCategories = (()=>{window.bad=true; return []})();</script>",
  );
  const { d, w } = await open(t, source);
  assert.match(root(d).textContent, /分类配置暂不可用/);
  assert.equal(w.bad, undefined);
  assert.equal(root(d).querySelectorAll("input[type=radio]").length, 0);
  assert.equal(root(d).querySelector(".badge_tag[role=button]"), null);
  enter(w, d, "alpha");
  assert.deepEqual(visible(d), ["1"]);
  [...root(d).querySelectorAll(".ug-sort button")]
    .find((n) => n.textContent === "从少到多")
    .click();
  assert.deepEqual(visible(d), ["1"]);
  assert.ok(root(d).querySelector("mark"));
});

test("复用原生搜索与标签样式，同时保持键盘可达和筛选隐藏", async (t) => {
  const { d, w } = await open(t);
  const style = d.createElement("style");
  style.textContent = await readFile(
    new URL("./fixtures/garage-filters.css", import.meta.url),
    "utf8",
  );
  // Native styles load before the userscript; jsdom does not fully model CSS specificity.
  d.head.prepend(style);
  const bridge = d.querySelector("[data-user-gadgets-style]");
  bridge.remove();
  d.head.append(bridge);
  assert.ok(search(d).closest(".searchBar .inner"));
  assert.equal(
    root(d).querySelector(".ug-search").nextElementSibling.className,
    "sideInner ug-filter",
  );
  const radio = option(d, "功能增强");
  assert.notEqual(w.getComputedStyle(radio).display, "none");
  radio.focus();
  assert.equal(d.activeElement, radio);
  radio.click();
  const checkbox = option(d, "UI", "checkbox");
  assert.notEqual(w.getComputedStyle(checkbox).display, "none");
  checkbox.focus();
  checkbox.click();
  assert.equal(d.activeElement, checkbox);
  assert.equal(checkbox.closest("label").classList.contains("selected"), true);
  assert.equal(
    w.getComputedStyle(root(d).querySelector('[data-user-gadgets-item="3"]'))
      .display,
    "none",
  );
  enter(w, d, "UI");
  assert.ok(root(d).querySelector(".badge_tag.highlighted"));
  assert.equal(root(d).querySelector(".badge_tag mark"), null);
  enter(w, d, "评分");
  for (const theme of ["light", "dark"]) {
    d.documentElement.dataset.theme = theme;
    const mark = root(d).querySelector("h3 mark");
    assert.notEqual(
      w.getComputedStyle(mark).color,
      w.getComputedStyle(mark).backgroundColor,
    );
  }
});

test("作者子集位置式分类、固定计数及关联 AND 与动态禁用", async (t) => {
  const { d, w } = await open(t);
  assert.deepEqual(
    [...root(d).querySelectorAll("input[type=radio]")].map((n) => [
      n.closest("label").querySelector(".ug-option-name").textContent,
      count(n),
    ]),
    [
      ["功能增强", "3"],
      ["评分与统计", "2"],
      ["界面优化", "1"],
      ["美化", "1"],
      ["未分类", "2"],
    ],
  );
  assert.equal(root(d).querySelectorAll("input[type=checkbox]").length, 0);
  option(d, "功能增强").click();
  assert.deepEqual(visible(d), ["1", "2", "6"]);
  assert.deepEqual(
    [...root(d).querySelectorAll("input[type=checkbox]")].map((n) => [
      n.closest("label").querySelector(".ug-option-name").textContent,
      count(n),
    ]),
    [
      ["UI", "2"],
      ["共用", "1"],
      ["无效", "1"],
      ["界面优化", "1"],
      ["独有", "1"],
    ],
  );
  option(d, "UI", "checkbox").click();
  assert.deepEqual(visible(d), ["1", "2"]);
  assert.equal(option(d, "独有", "checkbox").disabled, true);
  option(d, "共用", "checkbox").click();
  assert.deepEqual(visible(d), ["1"]);
  enter(w, d, "没有");
  assert.deepEqual(visible(d), []);
  assert.equal(count(option(d, "UI", "checkbox")), "2");
  assert.equal(option(d, "UI", "checkbox").disabled, false);
  assert.match(root(d).textContent, /没有符合当前条件的组件/);
  option(d, "UI", "checkbox").click();
  assert.equal(option(d, "UI", "checkbox").checked, false);
  assert.ok(option(d, "评分与统计"));
});
