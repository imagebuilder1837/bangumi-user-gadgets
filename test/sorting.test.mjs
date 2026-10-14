import { test } from "node:test";
import assert from "node:assert/strict";
import { card, garage, settle, setup } from "./support/fixtures.mjs";

function sortCard(id, collects, created, updated) {
  return card(id)
    .replace("21014", collects ?? "未知")
    .replace("2018-2-26 19:21", created ?? "未知")
    .replace("2020-4-4 10:30", updated ?? "未知");
}
const cards = [
  sortCard("91", "2", "2020-2-1 00:00", "2021-1-1 00:00"),
  sortCard("12", "10", "2020-10-1 00:00", "2019-1-1 00:00"),
  sortCard("73", "1,000", "2018-1-1 00:00", "2022-1-1 00:00"),
].join("");
const items = (d) => [...d.querySelectorAll("[data-user-gadgets-item]")];
const order = (d) => items(d).map((n) => n.dataset.userGadgetsItem);
function button(d, text) {
  const node = [...d.querySelectorAll("[data-user-gadgets-view] button")].find(
    (n) => n.textContent === text,
  );
  assert.ok(node, `存在排序按钮：${text}`);
  return node;
}

test("热门默认数值降序，双向排序移动卡片且不读取、不导航、不滚动或抢焦点", async (t) => {
  let reads = 0;
  const { d, w, app } = setup("https://bgm.tv/user/alice#gadgets", async () => {
    reads++;
    return new Response(garage(cards));
  });
  t.after(() => {
    app.stop();
    w.close();
  });
  await settle();
  assert.deepEqual(order(d), ["73", "12", "91"]);
  const original = items(d);
  const popularity = button(d, "热门程度");
  assert.equal(popularity.getAttribute("aria-pressed"), "true");
  assert.equal(button(d, "从多到少").getAttribute("aria-pressed"), "true");
  const ascending = button(d, "从少到多");
  const bar = ascending.closest('[aria-label="组件排序"]');
  assert.equal(
    bar.parentElement,
    d.querySelector("[data-user-gadgets-view] .ug-list"),
  );
  assert.equal(
    bar.nextElementSibling,
    d.querySelector("[data-user-gadgets-view] .gadgetList"),
  );
  ascending.focus();
  let scrolls = 0;
  w.scrollTo = () => scrolls++;
  const url = w.location.href;
  const history = w.history.length;
  ascending.click();
  assert.deepEqual(order(d), ["91", "12", "73"]);
  assert.equal(d.activeElement, ascending);
  button(d, "从多到少").click();
  assert.deepEqual(order(d), ["73", "12", "91"]);
  for (const n of items(d)) assert.ok(original.includes(n));
  assert.equal(reads, 1);
  assert.equal(scrolls, 0);
  assert.equal(w.location.href, url);
  assert.equal(w.history.length, history);
});

test("明确日期按数值双向比较，每指标方向独立记忆并在同文档重入恢复", async (t) => {
  let reads = 0;
  const fetch = async () => {
    reads++;
    return new Response(garage(cards));
  };
  const { d, w, app } = setup("https://bgm.tv/user/alice#gadgets", fetch);
  t.after(() => {
    app.stop();
    w.close();
  });
  await settle();
  button(d, "从少到多").click();
  button(d, "创建日期").click();
  assert.equal(button(d, "创建日期").getAttribute("aria-pressed"), "true");
  assert.equal(button(d, "从新到旧").getAttribute("aria-pressed"), "true");
  assert.deepEqual(order(d), ["12", "91", "73"]);
  button(d, "从旧到新").click();
  assert.deepEqual(order(d), ["73", "91", "12"]);
  button(d, "更新日期").click();
  assert.equal(button(d, "从新到旧").getAttribute("aria-pressed"), "true");
  assert.deepEqual(order(d), ["73", "91", "12"]);
  button(d, "从旧到新").click();
  assert.deepEqual(order(d), ["12", "91", "73"]);
  button(d, "热门程度").click();
  assert.equal(button(d, "从少到多").getAttribute("aria-pressed"), "true");
  assert.deepEqual(order(d), ["91", "12", "73"]);
  button(d, "创建日期").click();
  assert.equal(button(d, "从旧到新").getAttribute("aria-pressed"), "true");
  button(d, "更新日期").click();
  w.location.hash = "";
  await settle();
  w.location.hash = "#gadgets";
  await settle();
  assert.equal(button(d, "更新日期").getAttribute("aria-pressed"), "true");
  assert.equal(button(d, "从旧到新").getAttribute("aria-pressed"), "true");
  assert.deepEqual(order(d), ["12", "91", "73"]);
  button(d, "热门程度").click();
  assert.equal(button(d, "从少到多").getAttribute("aria-pressed"), "true");
  button(d, "创建日期").click();
  assert.equal(button(d, "从旧到新").getAttribute("aria-pressed"), "true");
  assert.equal(reads, 1);
  const fresh = setup("https://bgm.tv/user/alice#gadgets", fetch);
  t.after(() => {
    fresh.app.stop();
    fresh.w.close();
  });
  await settle();
  assert.equal(
    button(fresh.d, "热门程度").getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    button(fresh.d, "从多到少").getAttribute("aria-pressed"),
    "true",
  );
  assert.deepEqual(order(fresh.d), ["73", "12", "91"]);
});

for (const metric of ["热门程度", "创建日期", "更新日期"])
  test(`${metric} 平局保留当前次序，缺值双向后置，反向和重入不反转平局`, async (t) => {
    // ID deliberately disagrees with both response order and date order.
    const html = garage(
      [
        sortCard("90", "10", "2020-1-1 00:00", "2020-1-1 00:00"),
        sortCard("80", null, "2020-2-30 00:00", null),
        sortCard("11", "10", "2020-1-1 00:00", "2020-1-1 00:00"),
        sortCard("22", "2", "2018-1-1 00:00", "2018-1-1 00:00"),
        sortCard("33", null, null, "不详"),
      ].join(""),
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
    const original = items(d);
    button(d, metric).click();
    assert.deepEqual(order(d), ["90", "11", "22", "80", "33"]);
    button(d, metric === "热门程度" ? "从少到多" : "从旧到新").click();
    assert.deepEqual(order(d), ["22", "90", "11", "80", "33"]);
    button(d, metric === "热门程度" ? "从多到少" : "从新到旧").click();
    assert.deepEqual(order(d), ["90", "11", "22", "80", "33"]);
    assert.equal(items(d).length, 5);
    for (const n of items(d)) assert.ok(original.includes(n));
    w.location.hash = "";
    await settle();
    w.location.hash = "#gadgets";
    await settle();
    assert.deepEqual(order(d), ["90", "11", "22", "80", "33"]);
  });

test("切指标的平局沿用上次排序结果而不是响应次序，缺值之间也稳定", async (t) => {
  const html = garage(
    [
      sortCard("90", "10", "2018-1-1 00:00", null),
      sortCard("80", null, "2020-1-1 00:00", null),
      sortCard("11", "10", "2021-1-1 00:00", null),
      sortCard("22", "0", "2022-1-1 00:00", null),
      sortCard("33", null, "2023-1-1 00:00", null),
    ].join(""),
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
  button(d, "创建日期").click();
  assert.deepEqual(order(d), ["33", "22", "11", "80", "90"]);
  button(d, "热门程度").click();
  assert.deepEqual(order(d), ["11", "90", "22", "33", "80"]);
  button(d, "从少到多").click();
  assert.deepEqual(order(d), ["22", "11", "90", "33", "80"]);
  button(d, "更新日期").click();
  assert.deepEqual(order(d), ["22", "11", "90", "33", "80"]);
  button(d, "从旧到新").click();
  assert.deepEqual(order(d), ["22", "11", "90", "33", "80"]);
  w.location.hash = "";
  await settle();
  w.location.hash = "#gadgets";
  await settle();
  assert.deepEqual(order(d), ["22", "11", "90", "33", "80"]);
});
