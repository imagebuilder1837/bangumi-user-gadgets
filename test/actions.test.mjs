import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { startApp } from "../src/entry.mjs";
import { card, garage, host, fakeTime } from "./support/fixtures.mjs";

async function scene(
  t,
  html = garage(card() + card("32")),
  origin = "https://bgm.tv",
) {
  const dom = new JSDOM(host, { url: `${origin}/user/alice#gadgets` });
  const w = dom.window,
    d = w.document,
    time = fakeTime(),
    requests = [];
  w.scrollTo = () => {};
  w.confirm = () => assert.fail("无确认弹窗");
  const app = startApp({
    window: w,
    timers: time,
    now: time.now,
    fetch(url, options) {
      if (url === `${origin}/dev/garage`) {
        requests.push({ url, options });
        return Promise.resolve(new Response(html));
      }
      return new Promise((resolve, reject) =>
        requests.push({ url, options, resolve, reject }),
      );
    },
  });
  t.after(() => {
    app.stop();
    w.close();
  });
  await time.advance(0);
  return {
    w,
    d,
    time,
    requests,
    button: (id = "31") =>
      d.querySelector(`[data-user-gadgets-item="${id}"] .btnToggleGadget`),
  };
}

test("缺按钮或非法动作只读展示；仅当前响应的同源身份动作与令牌可提交", async (t) => {
  const invalid = [
    "https://bangumi.tv/dev/app/31/enable?gh=PRIVATE_TEST_TOKEN",
    "/dev/app/99/enable?gh=PRIVATE_TEST_TOKEN",
    "/dev/app/31/delete?gh=PRIVATE_TEST_TOKEN",
    "https://attacker:secret@bgm.tv/dev/app/31/enable?gh=PRIVATE_TEST_TOKEN",
    "/dev/app/31/enable?gh=PRIVATE_TEST_TOKEN#fragment",
    "/dev/app/31/enable",
    "/dev/app/31/enable?gh=a&gh=b",
  ];
  for (const href of invalid) {
    await t.test(href.replace(/gh=[^#]*/, "gh=REDACTED"), async (t) => {
      const { d, button, requests } = await scene(
        t,
        garage(card().replace("/dev/app/31/enable?gh=REDACTED", href)),
      );
      assert.equal(button(), null);
      assert.ok(d.querySelector("h3 a.title"));
      assert.equal(requests.length, 1);
      assert.doesNotMatch(
        d.querySelector("[data-user-gadgets-view]").textContent,
        /PRIVATE_TEST_TOKEN/,
      );
    });
  }
  const { button, d } = await scene(
    t,
    garage(card().replace(/<a class="btnToggleGadget[\s\S]*?<\/a>/, "")),
  );
  assert.equal(button(), null);
  assert.ok(d.querySelector('[aria-label="搜索组件"]'));
});

for (const origin of [
  "https://bgm.tv",
  "https://bangumi.tv",
  "https://chii.in",
])
  test(`${origin} 仅使用本次响应凭证，AJAX 参数合并且下一动作只反转路径；键盘防重`, async (t) => {
    const { w, time, requests, button } = await scene(
      t,
      garage(
        card().replace("gh=REDACTED", "gh=FRESH_FAKE&note=/enable&ajax=0"),
      ),
      origin,
    );
    const a = button();
    a.dispatchEvent(
      new w.KeyboardEvent("keydown", {
        key: " ",
        bubbles: true,
        cancelable: true,
      }),
    );
    a.click();
    assert.equal(requests.length, 2);
    const request = new URL(requests[1].url);
    assert.equal(request.origin, origin);
    assert.equal(request.searchParams.get("gh"), "FRESH_FAKE");
    assert.deepEqual(request.searchParams.getAll("ajax"), ["1"]);
    assert.equal(request.searchParams.get("note"), "/enable");
    requests[1].resolve({ ok: true });
    await time.advance(0);
    assert.equal(
      a.href,
      `${origin}/dev/app/31/disable?gh=FRESH_FAKE&note=/enable&ajax=0`,
    );
  });

test("动作锚点辅助点击不导航、不提交，尤其不能绕过在途防重", async (t) => {
  const { w, requests, button } = await scene(t);
  const a = button();
  function middleClick() {
    const event = new w.MouseEvent("auxclick", {
      button: 1,
      bubbles: true,
      cancelable: true,
    });
    a.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
  }
  middleClick();
  assert.equal(requests.length, 1);
  a.click();
  middleClick();
  assert.equal(requests.length, 2);
  assert.equal(a.textContent, "启用中…");
});

function route(w, hash) {
  // Explicit synthetic route event, not a claim about native browser timing.
  w.history.replaceState(null, "", hash || w.location.pathname);
  w.dispatchEvent(new w.HashChangeEvent("hashchange"));
}

for (const failure of ["http", "network", "timeout"])
  test(`${failure} 仅按钮红字错误、两秒恢复原方向，无自动重试或令牌泄漏`, async (t) => {
    const { w, d, time, requests, button } = await scene(
      t,
      garage(
        card().replace("/enable?gh=REDACTED", "/disable?gh=PRIVATE_TEST_TOKEN"),
      ),
    );
    const a = button();
    assert.equal(a.textContent, "停用");
    a.click();
    if (failure === "http") requests[1].resolve({ ok: false, status: 500 });
    if (failure === "network")
      requests[1].reject(new Error("PRIVATE_TEST_TOKEN"));
    await time.advance(failure === "timeout" ? 15000 : 0);
    assert.equal(a.textContent, "出错了");
    assert.equal(a.style.color, "rgb(255, 0, 0)");
    assert.equal(a.getAttribute("aria-disabled"), "false");
    assert.doesNotMatch(
      d.querySelector("[data-user-gadgets-view]").textContent,
      /PRIVATE_TEST_TOKEN/,
    );
    assert.equal(
      d.querySelector('[data-user-gadgets-view] [role="alert"]'),
      null,
    );
    assert.equal(w.localStorage.length, 0);
    await time.advance(1999);
    assert.equal(a.textContent, "出错了");
    await time.advance(1);
    assert.equal(a.textContent, "停用");
    assert.equal(a.style.color, "");
    assert.ok(a.classList.contains("btnRedSmall"));
    assert.equal(new URL(a.href).pathname, "/dev/app/31/disable");
    assert.equal(requests.length, 2);
    if (failure === "timeout") {
      requests[1].resolve({ ok: true });
      await time.advance(0);
      assert.equal(a.textContent, "停用");
    }
  });

test("退出不取消动作，重入复用在途；后台成功不重开、不写旧按钮，重入恢复结果", async (t) => {
  const { w, d, time, requests, button } = await scene(t);
  const old = button();
  old.click();
  route(w, "");
  await time.advance(0);
  assert.equal(requests[1].options.signal.aborted, false);
  assert.equal(d.querySelector("[data-user-gadgets-view]"), null);
  route(w, "#gadgets");
  await time.advance(0);
  const reentered = button();
  assert.notEqual(reentered, old);
  assert.equal(reentered.textContent, "启用中…");
  reentered.click();
  assert.equal(requests.length, 2);
  route(w, "");
  await time.advance(0);
  const title = d.title,
    focus = d.activeElement;
  let scrolls = 0;
  w.scrollTo = () => scrolls++;
  requests[1].resolve({ ok: true });
  await time.advance(0);
  assert.equal(d.querySelector("[data-user-gadgets-view]"), null);
  assert.equal(d.title, title);
  assert.equal(d.activeElement, focus);
  assert.equal(scrolls, 0);
  assert.equal(old.textContent, "启用中…");
  assert.equal(reentered.textContent, "启用中…");
  route(w, "#gadgets");
  await time.advance(0);
  assert.equal(button().textContent, "停用");
  assert.equal(requests.length, 2);
});

test("超时晚到结果与旧错误恢复不能覆盖较新操作；退出重入错误计时不重置", async (t) => {
  const { w, time, requests, button } = await scene(t);
  button().click();
  await time.advance(15000);
  const old = button();
  assert.equal(old.textContent, "出错了");
  route(w, "");
  await time.advance(1000);
  route(w, "#gadgets");
  await time.advance(0);
  assert.equal(button().textContent, "出错了");
  button().click();
  assert.equal(button().textContent, "启用中…");
  requests[1].resolve({ ok: true });
  await time.advance(1000);
  assert.equal(button().textContent, "启用中…");
  requests[2].resolve({ ok: true });
  await time.advance(0);
  assert.equal(button().textContent, "停用");
  await time.advance(2000);
  assert.equal(button().textContent, "停用");
  assert.equal(old.textContent, "出错了");
  button().click();
  requests[3].resolve({ ok: false });
  await time.advance(0);
  route(w, "");
  await time.advance(2000);
  route(w, "#gadgets");
  await time.advance(0);
  assert.equal(button().textContent, "停用");
  assert.equal(button().style.color, "");
});

test("排序、搜索高亮与隐藏移动卡片不替换按钮或打断动作，完成不重排或改人数", async (t) => {
  const { w, d, time, requests, button } = await scene(
    t,
    garage(card() + card("32").replace("21014", "1")),
  );
  const a = button(),
    li = a.closest("li"),
    list = li.parentElement;
  a.click();
  [...d.querySelectorAll("button")]
    .find((b) => b.textContent === "从少到多")
    .click();
  assert.equal(list.lastElementChild, li);
  const search = d.querySelector('[aria-label="搜索组件"]');
  search.value = "评分";
  search.dispatchEvent(
    new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  assert.ok(li.querySelector("mark"));
  assert.equal(button(), a);
  search.value = "无匹配";
  search.dispatchEvent(
    new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  assert.equal(li.hidden, true);
  assert.equal(button(), a);
  list.prepend(li); // public DOM movement must also preserve the button.
  requests[1].resolve({ ok: true });
  await time.advance(0);
  assert.equal(list.firstElementChild, li);
  assert.equal(button(), a);
  assert.equal(a.textContent, "停用");
  assert.equal(li.querySelector(".attr_collects").textContent, "21014");
  search.value = "";
  search.dispatchEvent(
    new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  assert.equal(li.hidden, false);
  assert.equal(button(), a);
});

test("查看者单击启用防重，其他组件可并发；HTTP 成功切换下一动作而不检查正文或人数", async (t) => {
  const { d, time, requests, button } = await scene(t);
  const a = button();
  assert.ok(a);
  assert.equal(a.textContent, "启用");
  assert.ok(a.classList.contains("btnGreenSmall"));
  a.click();
  a.click();
  assert.equal(a.textContent, "启用中…");
  assert.equal(a.getAttribute("aria-disabled"), "true");
  assert.equal(requests.length, 2);
  assert.equal(
    requests[1].url,
    "https://bgm.tv/dev/app/31/enable?gh=REDACTED&ajax=1",
  );
  assert.equal(requests[1].options.method, "GET");
  assert.equal(requests[1].options.credentials, "same-origin");
  assert.deepEqual(requests[1].options.headers, {
    "X-Requested-With": "XMLHttpRequest",
  });
  button("32").click();
  assert.equal(requests.length, 3);
  requests[1].resolve({
    ok: true,
    get redirected() {
      assert.fail("不检查登录跳转");
    },
    text() {
      assert.fail("不读取正文");
    },
  });
  await time.advance(0);
  assert.equal(button(), a);
  assert.equal(a.textContent, "停用");
  assert.ok(a.classList.contains("btnRedSmall"));
  assert.equal(a.href, "https://bgm.tv/dev/app/31/disable?gh=REDACTED");
  assert.equal(d.querySelector(".attr_collects").textContent, "21014");
  a.click();
  assert.equal(a.textContent, "停用中…");
  assert.equal(
    requests[3].url,
    "https://bgm.tv/dev/app/31/disable?gh=REDACTED&ajax=1",
  );
  requests[3].resolve({ ok: true });
  await time.advance(0);
  assert.equal(a.textContent, "启用");
  assert.equal(requests.length, 4);
});
