import { test } from "node:test";
import assert from "node:assert/strict";
import { card, garage, settle, setup } from "./support/fixtures.mjs";

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
