import { JSDOM } from "jsdom";
import { startApp } from "../../src/entry.mjs";

export const host = `<div id="wrapperNeue"><div id="headerProfile"><h1><span class="name"><a href="/user/alice">同名</a></span></h1><div class="navTabsWrapper"><ul class="navTabs"><li><a href="/user/alice" class="focus">首页</a></li><li><a href="/user/alice/blog">日志</a></li><li><a href="/user/alice/groups">小组</a></li></ul></div><div class="navSubTabsWrapper"><ul class="navSubTabs"></ul></div></div><div class="mainWrapper"><div id="original"><input></div><div id="footer">footer</div></div></div>`;
export const card = (id = "31", author = "alice") =>
  `<li id="item_${id}" class="clearit tml_item"><span class="avatar"><a href="/dev/app/${id}" class="avatar"><img src="/img/no_icon_gadget.png" width="40" alt="组件图标" class="avatar"></a></span><span class="info clearit"><a class="btnToggleGadget btnGreenSmall rr" href="/dev/app/${id}/enable?gh=REDACTED"><span>启用</span></a><h3><span class="badge_job">组件</span> <a class="title l" href="/dev/app/${id}">评分显示优化</a></h3><span class="tags" style="display: none;">功能增强 评分与统计 UI</span><span class="tip_i"><a href="/user/${author}" class="l">同名</a> 创建于 <span class="tip_j attr_timestamp">2018-2-26 19:21</span></span> · <span class="tip_i">更新 <span class="tip_j attr_lasttouch">2020-4-4 10:30</span></span> · <span class="tip_i"><span class="tip_j attr_collects">21014</span> 人启用</span><p class="desc">第一行\n<a href="https://bgm.tv/group/topic/345367">讨论</a><script>window.bad=true</script></p></span></li>`;
export const garage = (cards = card()) =>
  `<div id="columnSubjectBrowserA" class="columnAppBrowserA column"><div class="featuredContainer"><h2 class="title">特别推荐</h2><div class="featuredItems"><div class="grid"><div class="appItem gradient-1"><a href="/dev/app/99" class="title">推荐组件</a><p>by <a href="/user/alice">同名</a></p></div></div></div></div><div class="listContainer"><span class="text"><div id="timeline"><h2 class="title">组件格纳库</h2><ul class="gadgetList list_all">${cards}</ul></div></span></div></div><script>var tagCategories = [{"name":"功能增强","subCategories":["评分与统计"]}];</script>`;
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
