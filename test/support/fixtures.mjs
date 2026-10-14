import { JSDOM } from "jsdom";
import { startApp } from "../../src/entry.mjs";

export const host = `<div id="wrapperNeue"><div id="headerProfile"><h1><span class="name"><a href="/user/alice">同名</a></span></h1><div class="navTabsWrapper"><ul class="navTabs"><li><a href="/user/alice" class="focus">首页</a></li><li><a href="/user/alice/blog">日志</a></li><li><a href="/user/alice/groups">小组</a></li></ul></div><div class="navSubTabsWrapper"><ul class="navSubTabs"></ul></div></div><div class="mainWrapper"><div id="original"><input></div><div id="footer">footer</div></div></div>`;
export const card = (id = "31", author = "alice") =>
  `<li id="item_${id}"><span class="avatar"><a href="/dev/app/${id}"><img src="/img/no_icon_gadget.png"></a></span><span class="info"><a class="btnToggleGadget" href="/dev/app/${id}/enable?gh=REDACTED">启用</a><h3><a class="title" href="/dev/app/${id}">评分显示优化</a></h3><span class="tags">功能增强 评分与统计 UI</span><span class="tip_i"><a href="/user/${author}">同名</a></span><span class="attr_collects">21014</span><span class="attr_timestamp">2018-2-26 19:21</span><p class="desc">第一行\n<a href="https://bgm.tv/group/topic/345367">讨论</a><script>window.bad=true</script></p></span></li>`;
export const garage = (cards = card()) =>
  `<div id="columnSubjectBrowserA"><div id="timeline"><h2>组件格纳库</h2><ul class="gadgetList list_all">${cards}</ul></div></div><div class="recommend">${card("99")}</div><script>var tagCategories = [{"name":"功能增强","subCategories":["评分与统计"]}];</script>`;
export const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
export function fakeTime() {
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
export function setup(
  url = "https://bgm.tv/user/alice",
  fetch = async () => new Response(garage()),
) {
  const dom = new JSDOM(host, { url });
  dom.window.scrollTo = () => {};
  const app = startApp({ window: dom.window, fetch });
  return { dom, app, d: dom.window.document, w: dom.window };
}
