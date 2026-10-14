import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { startApp } from "../src/entry.mjs";
import { host, card, garage, settle } from "./support/fixtures.mjs";

const css = await readFile(
  new URL("./fixtures/garage-filters.css", import.meta.url),
  "utf8",
);
for (const theme of ["light", "dark"])
  test(`搜索命中标签整体使用原生蓝色，标题简介使用原生亮黄色（${theme}）`, async (t) => {
    const dom = new JSDOM(
      `<html data-theme="${theme}"><head><style>${css}</style></head><body>${host}</body></html>`,
      { url: "https://bgm.tv/user/alice#gadgets" },
    );
    const w = dom.window,
      d = w.document;
    w.scrollTo = () => {};
    const source = garage(
      card()
        .replace("功能增强 评分与统计 UI", "功能增强 评分与统计 UI 导航")
        .replace("第一行\n", "UI导航 "),
    );
    const app = startApp({
      window: w,
      fetch: async () => new Response(source),
    });
    const native = new JSDOM(
      `<html data-theme="${theme}"><head><style>${css}</style></head><body><span class="badge_tag highlighted">导航</span><mark>导航</mark></body></html>`,
    );
    t.after(() => {
      app.stop();
      w.close();
      native.window.close();
    });
    await settle();
    const root = d.querySelector("[data-user-gadgets-view]");
    const input = root.querySelector('input[aria-label="搜索组件"]');
    const search = (query) => {
      input.value = query;
      input.dispatchEvent(new w.Event("input"));
      input.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter" }));
    };
    const badges = [...root.querySelectorAll(".badge_tag")];
    const ui = badges.find((n) => n.textContent === "UI"),
      nav = badges.find((n) => n.textContent === "导航");
    search("ui 导航 评分");
    assert.equal(
      root.querySelectorAll(".item-tags mark").length,
      0,
      "标签不创建局部黄色 mark",
    );
    assert.deepEqual(
      badges
        .filter((n) => n.classList.contains("highlighted"))
        .map((n) => n.textContent),
      ["评分与统计", "UI", "导航"],
    );
    assert.equal(
      nav.getAttribute("aria-pressed"),
      "false",
      "搜索命中不是筛选选中",
    );
    for (const property of ["backgroundColor", "color"]) {
      assert.equal(
        w.getComputedStyle(nav)[property],
        native.window.getComputedStyle(
          native.window.document.querySelector(".badge_tag"),
        )[property],
        `标签 ${property}`,
      );
      for (const mark of root.querySelectorAll("h3 mark,.desc mark"))
        assert.equal(
          w.getComputedStyle(mark)[property],
          native.window.getComputedStyle(
            native.window.document.querySelector("mark"),
          )[property],
          `文本 ${property}`,
        );
    }
    assert.ok(root.querySelector("h3 mark"));
    assert.ok(root.querySelector(".desc mark"));
    nav.click();
    assert.equal(nav.getAttribute("aria-pressed"), "true");
    input.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape" }));
    assert.equal(
      nav.classList.contains("highlighted"),
      true,
      "清搜索仍保留标签选中高亮",
    );
    assert.equal(
      ui.classList.contains("highlighted"),
      false,
      "清搜索移除纯命中高亮",
    );
    search("导航");
    nav.click();
    assert.equal(nav.getAttribute("aria-pressed"), "false");
    assert.equal(
      nav.classList.contains("highlighted"),
      true,
      "取消选中仍保留搜索命中",
    );
    input.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape" }));
    assert.equal(nav.classList.contains("highlighted"), false);
    assert.equal(root.querySelectorAll("mark").length, 0);
    root.querySelector(".ug-reset").click();
    search("不存在");
    assert.equal(
      badges.some((n) => n.classList.contains("highlighted")),
      false,
    );
  });
