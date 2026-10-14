import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { card, garage, settle, setup } from "./support/fixtures.mjs";

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

test("简介沿用原站自然折行，显式换行与安全链接保留", async (t) => {
  const html = garage(
    card().replace("第一行\n", "普通源码\n\n换行<br>显式换行 "),
  );
  const { d, w, app } = setup(
    "https://bgm.tv/user/alice#gadgets",
    async () => new Response(html),
  );
  t.after(() => {
    app.stop();
    w.close();
  });
  await settle();
  const desc = d.querySelector("[data-user-gadgets-item] .desc");
  assert.equal(desc.querySelectorAll("br").length, 1);
  assert.match(desc.textContent, /普通源码\n\n换行/);
  assert.notEqual(w.getComputedStyle(desc).whiteSpace, "pre-wrap");
  assert.equal(
    desc.querySelector("a").href,
    "https://bgm.tv/group/topic/345367",
  );
  assert.equal(desc.querySelector("script"), null);
});

test("响应中的第三方警告位于简介与标签之间，安全呈现且排序和重入保留", async (t) => {
  const warning =
    "⚠️ 此组件含有第三方脚本或 API，可能带来潜在的安全风险，请谨慎启用。";
  const html = garage(
    card().replace(
      "</p></span></li>",
      `</p><p><span class="alarm">${warning}<script>window.bad=true</script><img src=x onerror="window.bad=true"></span></p></span></li>`,
    ) + card("32"),
  );
  const { d, w, app } = setup(
    "https://bgm.tv/user/alice#gadgets",
    async () => new Response(html),
  );
  t.after(() => {
    app.stop();
    w.close();
  });
  await settle();
  const item = d.querySelector('[data-user-gadgets-item="31"]');
  const alarm = item.querySelector("p > span.alarm");
  assert.ok(alarm, "保留格纳库警告");
  assert.equal(alarm.textContent, warning);
  assert.equal(alarm.children.length, 0);
  const style = d.createElement("style");
  style.textContent = await readFile(
    new URL("./fixtures/garage-card.css", import.meta.url),
    "utf8",
  );
  d.head.append(style);
  assert.equal(w.getComputedStyle(alarm).color, "rgb(204, 0, 0)");
  assert.equal(w.getComputedStyle(alarm).fontSize, "12px");
  assert.equal(alarm.parentElement.previousElementSibling.className, "desc");
  assert.equal(alarm.parentElement.nextElementSibling.className, "item-tags");
  assert.equal(d.querySelector('[data-user-gadgets-item="32"] .alarm'), null);
  const ascending = [...d.querySelectorAll("button")].find(
    (n) => n.textContent === "从少到多",
  );
  ascending.click();
  assert.equal(d.querySelector('[data-user-gadgets-item="31"] .alarm'), alarm);
  w.location.hash = "";
  await settle();
  w.location.hash = "#gadgets";
  await settle();
  assert.equal(
    d.querySelector('[data-user-gadgets-item="31"] .alarm').textContent,
    warning,
  );
  assert.equal(w.bad, undefined);
});

test("排序当前项仅保留无障碍状态，不添加常驻粉色背景", async (t) => {
  const { d, w, app } = setup("https://bgm.tv/user/alice#gadgets");
  t.after(() => {
    app.stop();
    w.close();
  });
  await settle();
  const buttons = [...d.querySelectorAll('[aria-label="组件排序"] button')];
  const selected = buttons.find(
    (n) => n.getAttribute("aria-pressed") === "true",
  );
  const unselected = buttons.find(
    (n) => n.getAttribute("aria-pressed") === "false",
  );
  assert.equal(
    w.getComputedStyle(selected).backgroundColor,
    w.getComputedStyle(unselected).backgroundColor,
  );
  const selectors = [
    ...d.querySelector("[data-user-gadgets-style]").sheet.cssRules,
  ]
    .map((rule) => rule.selectorText || "")
    .join(" ");
  assert.doesNotMatch(selectors, /aria-pressed/);
});

for (const theme of ["light", "dark"])
  test(`组件卡片复用格纳库字号、图标定位、信息分隔线与标签样式（${theme}）`, async (t) => {
    const css = await readFile(
      new URL("./fixtures/garage-card.css", import.meta.url),
      "utf8",
    );
    const html = await readFile(
      new URL("./fixtures/garage.html", import.meta.url),
      "utf8",
    );
    const reference = new JSDOM(
      `<html data-theme="${theme}"><head><style>${css}</style></head><body>${html}</body></html>`,
      { url: "https://bgm.tv/dev/garage" },
    );
    const { d, w, app } = setup("https://bgm.tv/user/alice#gadgets");
    t.after(() => {
      app.stop();
      w.close();
      reference.window.close();
    });
    d.documentElement.dataset.theme = theme;
    const style = d.createElement("style");
    style.textContent = css;
    d.head.append(style);
    await settle();
    const actual = d.querySelector("[data-user-gadgets-item]"),
      expected = reference.window.document.querySelector("#timeline li");
    const actualText = d.querySelector("[data-user-gadgets-view] .text"),
      expectedText = expected.closest(".text");
    assert.ok(actualText, "保留格纳库 .text 字号及行高继承层");
    for (const property of ["fontSize", "lineHeight"])
      assert.equal(
        w.getComputedStyle(actualText)[property],
        reference.window.getComputedStyle(expectedText)[property],
        `${property} 来自格纳库文本层`,
      );
    // Computed values catch missing ancestor-ID rules; this is not a layout test.
    for (const [selector, properties] of [
      [
        "",
        ["display", "position", "marginTop", "paddingTop", "borderBottomStyle"],
      ],
      [
        ".info",
        [
          "display",
          "fontSize",
          "marginLeft",
          "paddingBottom",
          "color",
          "borderBottomStyle",
          "borderBottomColor",
        ],
      ],
      ["h3", ["fontSize", "marginBottom"]],
      ["span.avatar", ["position", "left", "width", "height", "marginLeft"]],
      ["img.avatar", ["borderRadius", "paddingTop"]],
      [".item-tags", ["marginTop", "gap"]],
      [
        ".badge_tag",
        [
          "borderRadius",
          "backgroundColor",
          "color",
          "fontSize",
          "paddingLeft",
          "borderColor",
        ],
      ],
      [".attr_timestamp", ["color", "fontSize"]],
      [".attr_lasttouch", ["color", "fontSize"]],
      [".attr_collects", ["color", "fontSize"]],
    ]) {
      const actualNode = selector ? actual.querySelector(selector) : actual;
      const expectedNode = selector
        ? expected.querySelector(selector)
        : expected;
      assert.ok(expectedNode, `原站样本包含 ${selector}`);
      assert.ok(actualNode, `呈现原站字段 ${selector}`);
      const a = w.getComputedStyle(actualNode),
        b = reference.window.getComputedStyle(expectedNode);
      for (const property of properties)
        assert.equal(
          a[property],
          b[property],
          `${selector || "卡片"} ${property} 与格纳库一致`,
        );
    }
    assert.equal(actual.querySelector("img").width, 40);
    assert.equal(
      actual.querySelector("h3 a").href,
      "https://bgm.tv/dev/app/31",
    );
    assert.equal(d.querySelector("[data-user-gadgets-view] #timeline"), null);
  });
