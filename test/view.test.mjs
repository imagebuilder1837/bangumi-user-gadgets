import { test } from "node:test";
import assert from "node:assert/strict";
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
