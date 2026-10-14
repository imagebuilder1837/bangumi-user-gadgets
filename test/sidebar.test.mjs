import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { startApp } from "../src/entry.mjs";
import { host, garage, settle } from "./support/fixtures.mjs";

const css = await readFile(
  new URL("./fixtures/garage-filters.css", import.meta.url),
  "utf8",
);
// Minimal native DOM from the saved bgm.tv garage. No host IDs are copied to the app.
const sidebar = `<div id="columnSubjectBrowserB"><div class="sideInner"><h2 class="subtitle">搜索组件</h2><div class="search"><div class="searchBar"><div class="inner"><input class="textfield" type="text"></div></div></div></div><div class="sideInner"><div class="filter-section"><h2 class="subtitle">组件筛选 <a class="l rr"><small>重置</small></a></h2></div></div></div>`;

for (const theme of ["light", "dark"])
  test(`搜索与筛选面板匹配格纳库外框、标题条与输入留白（${theme}）`, async (t) => {
    const reference = new JSDOM(
      `<html data-theme="${theme}"><head><style>${css}</style></head><body>${sidebar}</body></html>`,
    );
    const dom = new JSDOM(
      `<html data-theme="${theme}"><head><style>${css}</style></head><body>${host}</body></html>`,
      { url: "https://bgm.tv/user/alice#gadgets" },
    );
    dom.window.scrollTo = () => {};
    const app = startApp({
      window: dom.window,
      fetch: async () => new Response(garage()),
    });
    t.after(() => {
      app.stop();
      dom.window.close();
      reference.window.close();
    });
    await settle();
    const actual = dom.window.document.querySelector(".ug-tools");
    const expected = reference.window.document.querySelector(
      "#columnSubjectBrowserB",
    );
    const panels = [...actual.querySelectorAll(".sideInner")];
    assert.equal(panels.length, 2);
    for (let i = 0; i < 2; i++) {
      const nativePanel = expected.children[i];
      for (const [a, b, properties] of [
        [
          panels[i],
          nativePanel,
          [
            "backgroundColor",
            "borderTopWidth",
            "borderTopStyle",
            "borderTopColor",
            "borderRadius",
            "paddingTop",
            "paddingBottom",
            "marginBottom",
          ],
        ],
        [
          panels[i].querySelector("h2"),
          nativePanel.querySelector("h2"),
          [
            "backgroundColor",
            "borderRadius",
            "paddingTop",
            "paddingRight",
            "paddingBottom",
            "paddingLeft",
            "marginLeft",
            "marginRight",
            "fontSize",
            "fontWeight",
            "color",
          ],
        ],
      ])
        for (const property of properties)
          assert.equal(
            dom.window.getComputedStyle(a)[property],
            reference.window.getComputedStyle(b)[property],
            `${i === 0 ? "搜索" : "筛选"} ${property}`,
          );
    }
    for (const [selector, properties] of [
      [".search", ["marginTop", "marginRight", "marginBottom", "marginLeft"]],
      [".searchBar", ["backgroundColor", "borderRadius"]],
      [
        ".textfield",
        [
          "boxSizing",
          "borderRadius",
          "paddingTop",
          "paddingRight",
          "paddingBottom",
          "paddingLeft",
        ],
      ],
    ]) {
      const a = actual.querySelector(selector),
        b = expected.querySelector(selector);
      assert.ok(a, `保留原生 ${selector} 层级`);
      for (const property of properties)
        assert.equal(
          dom.window.getComputedStyle(a)[property],
          reference.window.getComputedStyle(b)[property],
          `${selector} ${property}`,
        );
    }
    actual.querySelector("input[type=radio]").click();
    const reset = actual.querySelector(".ug-reset small");
    assert.ok(reset, "重置沿用原生标题内 small");
    assert.equal(
      dom.window.getComputedStyle(reset).fontSize,
      reference.window.getComputedStyle(expected.querySelector("h2 small"))
        .fontSize,
    );
    const resetButton = reset.parentElement;
    assert.equal(resetButton.tagName, "BUTTON");
    assert.equal(resetButton.type, "button");
    assert.equal(resetButton.classList.contains("l"), true);
    assert.equal(resetButton.classList.contains("rr"), true);
    for (const property of ["color", "borderTopWidth", "textDecoration"])
      assert.equal(
        dom.window.getComputedStyle(resetButton)[property],
        reference.window.getComputedStyle(expected.querySelector("a.l"))[
          property
        ],
        `重置 ${property}`,
      );
    assert.equal(actual.querySelector("#columnSubjectBrowserB"), null);
    assert.equal(
      dom.window.document.querySelectorAll("[id]").length,
      new Set(
        [...dom.window.document.querySelectorAll("[id]")].map((n) => n.id),
      ).size,
    );
  });
