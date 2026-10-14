// ==UserScript==
// @name         Bangumi 用户组件
// @namespace    https://github.com/imagebuilder1837/bangumi-user-gadgets
// @version      0.1.0
// @description  在 Bangumi 用户页个人导航中增加“组件”入口，查看该用户发布的超合金组件。
// @author       imagebuilder1837
// @match        https://bgm.tv/user/*
// @match        https://bgm.tv/anime/list/*
// @match        https://bgm.tv/book/list/*
// @match        https://bgm.tv/music/list/*
// @match        https://bgm.tv/game/list/*
// @match        https://bgm.tv/real/list/*
// @match        https://bangumi.tv/user/*
// @match        https://bangumi.tv/anime/list/*
// @match        https://bangumi.tv/book/list/*
// @match        https://bangumi.tv/music/list/*
// @match        https://bangumi.tv/game/list/*
// @match        https://bangumi.tv/real/list/*
// @match        https://chii.in/user/*
// @match        https://chii.in/anime/list/*
// @match        https://chii.in/book/list/*
// @match        https://chii.in/music/list/*
// @match        https://chii.in/game/list/*
// @match        https://chii.in/real/list/*
// @run-at       document-end
// @grant        none
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/imagebuilder1837/bangumi-user-gadgets/refs/heads/main/src/index.user.js
// @updateURL    https://raw.githubusercontent.com/imagebuilder1837/bangumi-user-gadgets/refs/heads/main/src/index.user.js
// ==/UserScript==

// Generated from src/main.mjs. Do not edit; run npm run build.
(function () {
  "use strict";

  const userPath =
    /^\/user\/([^/]+)(?:\/(blog|index|friends|rev_friends|timeline|mono|groups|wiki)(?:\/[^/]+)*)?\/?$/;
  const collectionPath =
    /^\/(anime|book|music|game|real)\/list\/([^/]+)(?:\/(wish|collect|do|on_hold|dropped))?\/?$/;

  function inspectHost(window, takeover = false) {
    const { document: d, location: l } = window;
    if (
      l.protocol !== "https:" ||
      !["bgm.tv", "bangumi.tv", "chii.in"].includes(l.hostname)
    )
      return null;
    const u = userPath.exec(l.pathname),
      c = collectionPath.exec(l.pathname);
    if (!u && !c) return null;
    const profile = d.querySelector("#headerProfile"),
      nav = profile?.querySelector(".navTabs");
    if (!nav) return null;
    const fail = (reason) => ({ nav, profile, reason });
    let user;
    try {
      user = decodeURIComponent(u?.[1] || c[2]);
    } catch {
      return fail("页面中的用户标识无法解码。");
    }
    if (!/^[\p{L}\p{N}_-]+$/u.test(user))
      return fail("页面中的用户标识格式无效。");
    const links = [...nav.querySelectorAll(":scope > li > a[href]")];
    const blogs = links.filter((a) => {
      const url = new URL(a.href);
      return (
        url.origin === l.origin && /^\/user\/[^/]+\/blog\/?$/.test(url.pathname)
      );
    });
    if (!blogs.length) return fail("个人导航中未找到目标用户的日志链接。");
    try {
      if (
        blogs.some(
          (a) =>
            decodeURIComponent(new URL(a.href).pathname.split("/")[2]) !== user,
        )
      )
        return fail("个人导航中的日志链接与页面目标用户身份冲突。");
    } catch {
      return fail("日志链接用户标识无法解码。");
    }
    const group = links.find((a) => {
      const url = new URL(a.href);
      try {
        return (
          a.textContent.trim() === "小组" &&
          url.origin === l.origin &&
          decodeURIComponent(url.pathname).replace(/\/$/, "") ===
            `/user/${user}/groups`
        );
      } catch {
        return false;
      }
    });
    if (!group) return null;
    const name = profile.querySelector("h1 .name");
    const nickname =
      [...(name?.querySelectorAll(":scope > a[href]") || [])]
        .find((a) => {
          try {
            return (
              new URL(a.href).origin === l.origin &&
              decodeURIComponent(new URL(a.href).pathname).replace(
                /\/$/,
                "",
              ) === `/user/${user}`
            );
          } catch {
            return false;
          }
        })
        ?.textContent.trim() ||
      [...(name?.childNodes || [])]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join("")
        .trim() ||
      user;
    const base = { user, nickname, nav, profile, group };
    if (!takeover) return base;
    const scope = profile.closest("#wrapperNeue") || profile.parentElement;
    const mains = [...scope.querySelectorAll(".mainWrapper")].filter(
      (m) =>
        !m.contains(profile) &&
        !profile.contains(m) &&
        profile.compareDocumentPosition(m) &
          window.Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const boundaries = mains.flatMap((main) =>
      [...main.querySelectorAll(":scope > #footer")].map((footer) => ({
        main,
        footer,
      })),
    );
    if (boundaries.length !== 1)
      return fail("未找到唯一可靠的正文 footer 挂载边界。");
    const { main, footer } = boundaries[0];
    const content = [...main.children].slice(
      0,
      [...main.children].indexOf(footer),
    );
    if (
      !content.some(
        (node) =>
          !["SCRIPT", "STYLE", "LINK", "TEMPLATE"].includes(node.tagName) &&
          !node.hasAttribute("data-user-gadgets-view") &&
          !node.hasAttribute("data-user-topics-view"),
      )
    )
      return fail("未找到 footer 前可靠的原始正文。");
    const sub = [...profile.querySelectorAll(".navSubTabsWrapper")].find(
      (n) =>
        n.querySelector(":scope > .navSubTabs") &&
        !n.contains(nav) &&
        !nav.contains(n) &&
        ![...n.attributes].some((a) => a.name.startsWith("data-user-topics-")),
    );
    return { ...base, ...boundaries[0], sub };
  }

  // Attribute observers relinquish ownership, never repair active host structure.
  function ownAttribute(w, node, name, value) {
    const old = node.getAttribute(name);
    node.setAttribute(name, value);
    let owned = true;
    const observer = new w.MutationObserver(() => {
      owned = false;
    });
    observer.observe(node, { attributes: true, attributeFilter: [name] });
    return () => {
      if (observer.takeRecords().length) owned = false;
      observer.disconnect();
      if (!owned || !node.isConnected || node.getAttribute(name) !== value)
        return;
      if (old === null) node.removeAttribute(name);
      else node.setAttribute(name, old);
    };
  }

  function ownFocus(w, node, enabled, canRestore = () => true) {
    const previous = node.classList.contains("focus");
    node.classList.toggle("focus", enabled);
    let owned = true;
    const containsFocus = (value) =>
      (value || "").split(/\s+/).includes("focus");
    const observeChanges = (records) => {
      for (let i = 0; i < records.length; i++) {
        const before = containsFocus(records[i].oldValue);
        const after = containsFocus(
          i + 1 < records.length
            ? records[i + 1].oldValue
            : node.getAttribute("class"),
        );
        if (before !== after) owned = false;
      }
    };
    const observer = new w.MutationObserver(observeChanges);
    observer.observe(node, {
      attributes: true,
      attributeFilter: ["class"],
      attributeOldValue: true,
    });
    return () => {
      observeChanges(observer.takeRecords());
      observer.disconnect();
      if (
        owned &&
        node.isConnected &&
        node.classList.contains("focus") === enabled &&
        canRestore()
      )
        node.classList.toggle("focus", previous);
    };
  }

  function mountHost(w, host, link) {
    const d = w.document;
    const root = d.createElement("section");
    root.dataset.userGadgetsView = "";
    root.tabIndex = -1;
    const style = d.createElement("style");
    style.dataset.userGadgetsStyle = "";
    style.textContent = `[data-user-gadgets-hidden="on"] { display:none!important; }
[data-user-gadgets-view] { width:100%;max-width:1000px;margin:0 auto;padding:10px 0;box-sizing:border-box;min-height:200px; }
[data-user-gadgets-view] .ug-shell { display:flex;gap:15px; }
[data-user-gadgets-view] .ug-list { width:700px;min-width:0; }
[data-user-gadgets-view] .ug-tools { width:280px;flex-shrink:0; }
[data-user-gadgets-view] [hidden] { display:none!important; }
[data-user-gadgets-view] .ug-tools .sideInner { background-color:#fafafa;border:1px solid #eee;border-radius:15px;padding:5px 0 0;margin:0 0 10px; }
html[data-theme=dark] [data-user-gadgets-view] .ug-tools .sideInner { background-color:#3d3d3f;border-color:#444; }
[data-user-gadgets-view] .ug-tools .sideInner h2 { box-sizing:border-box;border:none;background-color:#fff;border-radius:15px;margin:0 5px;padding:5px 10px; }
html[data-theme=dark] [data-user-gadgets-view] .ug-tools .sideInner h2 { background-color:#303030; }
[data-user-gadgets-view] .ug-tools .sideInner h2 small { font-size:12px; }
[data-user-gadgets-view] .ug-tools .search { margin:5px; }
[data-user-gadgets-view] .ug-tools .searchBar { background-color:#fff; }
html[data-theme=dark] [data-user-gadgets-view] .ug-tools .searchBar { background-color:#303030; }
[data-user-gadgets-view] .ug-tools .search .textfield { border-radius:15px;box-sizing:border-box;width:100%;padding:5px 10px; }
[data-user-gadgets-view] .main-category { margin-bottom:10px; }
[data-user-gadgets-view] .main-category > .tag-checkbox { margin:5px;font-size:14px;font-weight:bold; }
[data-user-gadgets-view] .sub-categories,[data-user-gadgets-view] .related-tags-wrapper { display:flex;flex-wrap:wrap;gap:3px; }
[data-user-gadgets-view] .sub-categories { margin:0 5px; }
[data-user-gadgets-view] .related-tags-container { margin:5px 0 0 5px;padding-left:5px;border-left:2px solid #e0e0e0; }
html[data-theme=dark] [data-user-gadgets-view] .related-tags-container { border-color:#444; }
[data-user-gadgets-view] .related-tags-title { margin-bottom:5px;font-size:12px; }
[data-user-gadgets-view] .tag-checkbox { position:relative; }
[data-user-gadgets-view] .tag-checkbox input[type=radio],[data-user-gadgets-view] .tag-checkbox input[type=checkbox] { display:block;position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%); }
[data-user-gadgets-view] .tag-checkbox:focus-within,[data-user-gadgets-view] .badge_tag:focus-visible { outline:2px solid var(--primary-color,#f09199);outline-offset:2px; }
[data-user-gadgets-view] .tag-checkbox.ug-disabled { opacity:.45;cursor:not-allowed;background:none;color:inherit; }
[data-user-gadgets-view] .ug-disabled .tag-count { color:inherit; }
[data-user-gadgets-view] .ug-reset { border:0;background:none;color:inherit;font:inherit;cursor:pointer; }
[data-user-gadgets-view] mark { background:#ffe08a;color:#332900; }
html[data-theme=dark] [data-user-gadgets-view] mark { background:#806000;color:#fff; }
[data-user-gadgets-view] .ug-sort { display:flex;flex-wrap:wrap;align-items:baseline;gap:4px; }
[data-user-gadgets-view] .ug-sort .filters { display:flex;flex-wrap:wrap;align-items:baseline;gap:2px; }
[data-user-gadgets-view] .ug-sort-directions { margin-left:auto; }
[data-user-gadgets-view] .ug-sort button.l { appearance:none;border:0;background:none;color:#0084b4;font:inherit;cursor:pointer;border-radius:15px;padding:2px 8px; }
html[data-theme=dark] [data-user-gadgets-view] .ug-sort button.l { color:#2ea6ff; }
[data-user-gadgets-view] .ug-sort button:hover,[data-user-gadgets-view] .ug-sort button:focus-visible { background:var(--primary-color,#f09199);color:#fff; }
[data-user-gadgets-view] .ug-sort button:focus-visible { outline:2px solid currentColor;outline-offset:2px; }
[data-user-gadgets-view] .gadgetList { box-sizing:border-box;margin:0;padding:0;list-style:none; }
[data-user-gadgets-view] .gadgetList > li { box-sizing:border-box;margin:5px 0;padding:5px 0;position:relative;word-wrap:break-word; }
[data-user-gadgets-view] .gadgetList > li > span.avatar { display:block;height:50px;left:0;margin:0 5px;overflow:hidden;position:absolute;width:50px; }
[data-user-gadgets-view] .gadgetList > li > .info { display:block;font-size:14px;padding:0 5px 5px 0;margin-left:60px;border-bottom:1px dotted #e8e8e8;color:#666;min-height:35px; }
html[data-theme=dark] [data-user-gadgets-view] .gadgetList > li > .info { border-bottom-color:#555;color:#d8d8d8; }
[data-user-gadgets-view] .gadgetList h3 { font-size:14px;margin:0 0 3px; }
[data-user-gadgets-view] .gadgetList .desc { display:block;overflow-wrap:anywhere;margin:5px 0; }
@media(max-width:640px) { [data-user-gadgets-view] .ug-shell { flex-direction:column; } [data-user-gadgets-view] .ug-list,[data-user-gadgets-view] .ug-tools { width:100%; } [data-user-gadgets-view] .ug-tools { order:-1; } }`;
    const children = [...host.main.children].slice(
      0,
      [...host.main.children].indexOf(host.footer),
    );
    const previousFocus = children.some((n) => n.contains(d.activeElement))
      ? d.activeElement
      : null;
    const scroll = w.scrollY;
    const releases = [...children, ...(host.sub ? [host.sub] : [])].map((n) =>
      ownAttribute(w, n, "data-user-gadgets-hidden", "on"),
    );
    const focused = [...host.nav.querySelectorAll(":scope > li > a.focus")];
    // Own only the focus token; unrelated classes must survive restoration.
    const restoreNav = focused.map((n) =>
      ownFocus(w, n, false, () => !host.nav.querySelector("a.focus")),
    );
    const releaseLink = ownFocus(w, link, true);
    const title = d.title,
      ownedTitle = `${host.nickname} 的组件`;
    d.title = ownedTitle;
    let titleOwned = true;
    const titleObserver = new w.MutationObserver(() => {
      titleOwned = false;
    });
    titleObserver.observe(d.querySelector("title"), {
      childList: true,
      subtree: true,
      characterData: true,
    });
    d.head.append(style);
    host.footer.before(root);
    if (previousFocus) root.focus({ preventScroll: true });
    return {
      root,
      hide() {
        const active = d.activeElement;
        const restoreFocus =
          active === d.body || root.contains(active) || active === link;
        root.remove();
        style.remove();
        releases.forEach((release) => release());
        releaseLink();
        restoreNav.forEach((release) => release());
        if (titleObserver.takeRecords().length) titleOwned = false;
        titleObserver.disconnect();
        if (titleOwned && d.title === ownedTitle) d.title = title;
        if (restoreFocus && previousFocus?.isConnected)
          previousFocus.focus({ preventScroll: true });
        const native = w.location.hash.slice(1);
        if (!native || !d.getElementById(native)) w.scrollTo?.(0, scroll);
      },
    };
  }

  function safeURL(raw, origin, sameOrigin = false) {
    if (!raw) return null;
    try {
      const url = new URL(raw, origin);
      return ["https:", "http:"].includes(url.protocol) &&
        (!sameOrigin || url.origin === origin)
        ? url
        : null;
    } catch {
      return null;
    }
  }
  function description(node, origin) {
    if (!node) return [];
    return [...node.childNodes].flatMap((n) => {
      if (n.nodeType === 3) return [{ text: n.textContent }];
      if (
        n.nodeType !== 1 ||
        ["SCRIPT", "STYLE", "IFRAME", "OBJECT"].includes(n.tagName)
      )
        return [];
      if (n.tagName === "BR") return [{ text: "\n", break: true }];
      if (n.tagName === "A") {
        const url = safeURL(n.getAttribute("href"), origin);
        return [{ text: n.textContent, ...(url ? { href: url.href } : {}) }];
      }
      return description(n, origin);
    });
  }
  function date(node) {
    const text = node?.textContent.trim() || "";
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{2})$/.exec(text);
    if (!m) return { text, value: null };
    const [, y, mo, day, h, min] = m.map(Number);
    const value = Date.UTC(y, mo - 1, day, h, min),
      d = new Date(value);
    return {
      text,
      value:
        d.getUTCFullYear() === y &&
        d.getUTCMonth() === mo - 1 &&
        d.getUTCDate() === day &&
        h < 24 &&
        min < 60
          ? value
          : null,
    };
  }
  function parseGarage(window, html, origin) {
    const d = new window.DOMParser().parseFromString(html, "text/html");
    const lists = d.querySelectorAll(
      "#columnSubjectBrowserA #timeline > ul.gadgetList.list_all",
    );
    if (
      lists.length !== 1 ||
      !d.querySelector("#timeline h2")?.textContent.includes("组件格纳库") ||
      d.querySelector(
        '.page_inner, .pagination, .page, [rel="next"], form[action*="captcha"], #challenge-form',
      )
    )
      throw new Error("格纳库结构异常或列表不完整。");
    const items = new Map();
    for (const li of lists[0].children) {
      const title = li.querySelector("h3 a.title");
      const url = safeURL(title?.getAttribute("href"), origin, true);
      const id = /^\/dev\/app\/(\d+)$/.exec(url?.pathname || "")?.[1];
      const authorLinks = [...li.querySelectorAll(".info .tip_i a[href]")]
        .map((a) => ({ a, url: safeURL(a.getAttribute("href"), origin, true) }))
        .filter(({ url }) => /^\/user\/[^/]+\/?$/.test(url?.pathname || ""));
      if (
        !id ||
        li.id !== `item_${id}` ||
        !title.textContent.trim() ||
        authorLinks.length !== 1
      )
        throw new Error("组件缺少有效身份或作者。");
      let author;
      try {
        author = decodeURIComponent(authorLinks[0].url.pathname.split("/")[2]);
      } catch {
        throw new Error("组件作者标识无法解码。");
      }
      if (!/^[\p{L}\p{N}_-]+$/u.test(author))
        throw new Error("组件作者标识无效。");
      const collectsText =
        li
          .querySelector(".attr_collects")
          ?.textContent.trim()
          .replace(/,/g, "") || "";
      const action = [...li.querySelectorAll("a.btnToggleGadget[href]")]
        .map((a) => safeURL(a.getAttribute("href"), origin, true))
        .find(
          (u) =>
            u &&
            new RegExp(`^/dev/app/${id}/(enable|disable)$`).test(u.pathname),
        );
      const icon = li.querySelector(".avatar img");
      const item = {
        id,
        href: url.href,
        title: title.textContent.trim(),
        author,
        authorName: authorLinks[0].a.textContent.trim(),
        authorHref: authorLinks[0].url.href,
        icon: safeURL(icon?.getAttribute("src"), origin)?.href || null,
        description: description(li.querySelector("p.desc"), origin),
        warnings: [
          ...li.querySelectorAll(":scope > .info > p > span.alarm"),
        ].map((node) =>
          description(node, origin)
            .map((part) => part.text)
            .join(""),
        ),
        tags: (li.querySelector(".tags")?.textContent.trim() || "")
          .split(/\s+/)
          .filter(Boolean),
        collects: /^\d+$/.test(collectsText) ? Number(collectsText) : null,
        created: date(li.querySelector(".attr_timestamp")),
        updated: date(li.querySelector(".attr_lasttouch")),
        action: action?.href || null,
      };
      const previous = items.get(id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(item))
        throw new Error("重复组件 ID 的内容冲突。");
      if (!previous) items.set(id, item);
    }
    let categories = null;
    for (const script of d.querySelectorAll("script:not([src])")) {
      const m = /^\s*var\s+tagCategories\s*=\s*(\[[\s\S]*?\]);/.exec(
        script.textContent,
      );
      if (!m) continue;
      try {
        const parsed = JSON.parse(m[1]);
        if (
          Array.isArray(parsed) &&
          parsed.every(
            (c) =>
              c &&
              typeof c.name === "string" &&
              c.name &&
              Array.isArray(c.subCategories) &&
              c.subCategories.every((s) => typeof s === "string" && s),
          ) &&
          new Set(parsed.map((c) => c.name)).size === parsed.length
        )
          categories = parsed;
      } catch {
        /* Local configuration failure must not discard valid cards. */
      }
      break;
    }
    return { items: [...items.values()], categories };
  }

  async function readGarage({ window, fetch, timers, now }, origin) {
    const wait = (ms) =>
      new Promise((resolve) => timers.setTimeout(resolve, ms));
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new window.AbortController();
      let timeout;
      let response, html;
      try {
        const result = await Promise.race([
          (async () => {
            const r = await fetch(`${origin}/dev/garage`, {
              credentials: "same-origin",
              signal: controller.signal,
            });
            return { response: r, html: r.ok ? await r.text() : "" };
          })(),
          new Promise((_, reject) => {
            timeout = timers.setTimeout(() => {
              controller.abort();
              reject(new Error("读取超时。"));
            }, 15000);
          }),
        ]);
        ({ response, html } = result);
      } catch (error) {
        if (attempt === 2) throw new Error(`读取组件失败：${error.message}`);
      } finally {
        timers.clearTimeout(timeout);
      }
      if (response?.status === 429) {
        const retry = response.headers.get("Retry-After");
        const seconds =
          retry && /^\d+$/.test(retry.trim()) ? Number(retry) * 1000 : NaN;
        const dateValue = retry ? Date.parse(retry) - now() : NaN;
        const delay = Number.isFinite(seconds)
          ? seconds
          : Number.isFinite(dateValue) && dateValue >= 0
            ? dateValue
            : 60000;
        const error = new Error("格纳库请求过于频繁，请等待冷却结束后重试。");
        error.retryAt = now() + delay;
        throw error;
      }
      if (response?.ok) return parseGarage(window, html, origin);
      if (response && response.status !== 408 && response.status < 500)
        throw new Error(`读取组件失败（HTTP ${response.status}）。`);
      if (attempt === 2)
        throw new Error(
          `读取组件失败（HTTP ${response?.status || "网络异常"}）。`,
        );
      await wait((attempt + 1) * 1000);
    }
  }

  function authorItems(garage, user) {
    return garage.items.filter((item) => item.author === user);
  }

  function createFilters() {
    return { query: "", category: null, tags: [] };
  }

  function fold(text) {
    return text.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
  }

  function searchTerms(query) {
    return fold(query).split(/\s+/u).filter(Boolean);
  }

  function searchRanges(text, query) {
    const source = fold(text),
      ranges = [];
    for (const term of searchTerms(query)) {
      let start = source.indexOf(term);
      while (start !== -1) {
        ranges.push([start, start + term.length]);
        start = source.indexOf(term, start + 1);
      }
    }
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const range of ranges) {
      const last = merged.at(-1);
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else merged.push([...range]);
    }
    return merged;
  }

  function createCatalog(items, configuration) {
    const key = (main, sub = null) => JSON.stringify([main, sub]);
    const roles = new Map();
    for (const item of items) {
      const main = configuration?.find((c) => c.name === item.tags[0]);
      const sub = main?.subCategories.includes(item.tags[1])
        ? item.tags[1]
        : null;
      const consumed = main ? (sub ? 2 : 1) : 0;
      roles.set(item.id, {
        main: key(main?.name ?? null),
        sub: sub ? key(main.name, sub) : null,
        consumed,
        tags: [...new Set(item.tags.slice(consumed))],
      });
    }
    function inCategory(item, category) {
      const role = roles.get(item.id);
      return (
        category === null || role.main === category || role.sub === category
      );
    }
    function matches(item, filters) {
      const fields = [
        item.title,
        item.description.map((p) => p.text).join(""),
        ...item.tags,
      ].map(fold);
      return (
        inCategory(item, filters.category) &&
        filters.tags.every((tag) => roles.get(item.id).tags.includes(tag)) &&
        searchTerms(filters.query).every((term) =>
          fields.some((field) => field.includes(term)),
        )
      );
    }
    const categories = [];
    function addCategory(main, sub = null) {
      const category = key(main, sub);
      const count = items.filter((item) => inCategory(item, category)).length;
      if (count)
        categories.push({
          key: category,
          label: sub ?? main ?? "未分类",
          parent: sub ? key(main) : null,
          count,
        });
    }
    if (configuration) {
      for (const main of configuration) {
        addCategory(main.name);
        for (const sub of main.subCategories) addCategory(main.name, sub);
      }
      addCategory(null);
    }
    function related(filters) {
      if (filters.category === null || !configuration) return [];
      const counts = new Map();
      for (const item of items.filter((item) =>
        inCategory(item, filters.category),
      ))
        for (const tag of roles.get(item.id).tags)
          counts.set(tag, (counts.get(tag) || 0) + 1);
      return [...counts]
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => ({
          tag,
          count,
          selected: filters.tags.includes(tag),
          disabled:
            !filters.tags.includes(tag) &&
            !items.some((item) =>
              matches(item, { ...filters, tags: [...filters.tags, tag] }),
            ),
        }));
    }
    function selectCategory(filters, category) {
      filters.category = category === filters.category ? null : category;
      filters.tags = [];
    }
    function selectTag(filters, tag) {
      filters.tags = filters.tags.includes(tag)
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag];
    }
    function cardTag(filters, item, index) {
      if (!configuration) return;
      const role = roles.get(item.id);
      if (index < role.consumed)
        selectCategory(filters, index === 0 ? role.main : role.sub);
      else if (filters.tags.includes(item.tags[index]))
        selectTag(filters, item.tags[index]);
      else {
        filters.category = role.sub || role.main;
        filters.tags = [item.tags[index]];
      }
    }
    function tagSelected(filters, item, index) {
      const role = roles.get(item.id);
      return (
        !!configuration &&
        (index < role.consumed
          ? filters.category === (index === 0 ? role.main : role.sub)
          : filters.tags.includes(item.tags[index]))
      );
    }
    return {
      categories,
      matches,
      related,
      selectCategory,
      selectTag,
      cardTag,
      tagSelected,
    };
  }

  function createSorting() {
    return {
      metric: "collects",
      directions: { collects: "desc", created: "desc", updated: "desc" },
    };
  }

  function sortItems(items, sorting) {
    const { metric, directions } = sorting;
    const value = (item) =>
      metric === "collects" ? item.collects : item[metric].value;
    return [...items].sort((a, b) => {
      const av = value(a),
        bv = value(b);
      if (av == null) return bv == null ? 0 : 1;
      if (bv == null) return -1;
      return directions[metric] === "desc" ? bv - av : av - bv;
    });
  }

  // Keep the original text nodes and safe links; only generated highlight siblings change.
  function highlighter(document, container) {
    const walker = document.createTreeWalker(container, 5),
      parts = [];
    let text = "",
      node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) {
        parts.push({
          node,
          text: node.textContent,
          start: text.length,
          extras: [],
        });
        text += node.textContent;
      } else if (node.tagName === "BR") text += "\n";
    }
    let previous = null;
    return (query) => {
      if (query === previous) return;
      previous = query;
      const ranges = searchRanges(text, query);
      for (const part of parts) {
        for (const extra of part.extras) extra.remove();
        part.extras = [];
        const local = ranges
          .map(([a, b]) => [
            Math.max(a, part.start) - part.start,
            Math.min(b, part.start + part.text.length) - part.start,
          ])
          .filter(([a, b]) => a < b);
        if (!local.length) {
          part.node.textContent = part.text;
          continue;
        }
        part.node.textContent = part.text.slice(0, local[0][0]);
        let end = local[0][0];
        for (const [a, b] of local) {
          if (a > end)
            part.extras.push(document.createTextNode(part.text.slice(end, a)));
          const mark = document.createElement("mark");
          mark.textContent = part.text.slice(a, b);
          part.extras.push(mark);
          end = b;
        }
        if (end < part.text.length)
          part.extras.push(document.createTextNode(part.text.slice(end)));
        part.node.after(...part.extras);
      }
    };
  }

  function renderView(document, root, state, retry, now, changeSort, timers) {
    root.replaceChildren();
    const el = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    };
    const shell = el("div", "ug-shell"),
      list = el("div", "ug-list"),
      tools = el("aside", "ug-tools");
    shell.append(list, tools);
    root.append(shell);
    if (state.status !== "success") {
      const message = el(
        "p",
        "tip",
        state.status === "error" ? state.error.message : "正在加载组件…",
      );
      message.setAttribute("role", "status");
      list.append(message);
      if (state.status === "error") {
        const button = el("button", "chiiBtn", "重试");
        button.type = "button";
        button.addEventListener("click", () => {
          if (now() >= (state.error.retryAt || 0)) retry();
        });
        list.append(button);
      }
      return;
    }
    if (!state.items.length) {
      list.append(el("p", "tip", "格纳库中未找到该用户开发的组件"));
      return;
    }
    const bar = el("div", "browserTools clearit ug-sort"),
      metrics = el("div", "filters ug-sort-metrics"),
      directions = el("div", "filters ug-sort-directions"),
      ul = el("ul", "gadgetList list_all text"),
      nodes = new Map(),
      metricButtons = new Map(),
      directionButtons = new Map(),
      highlights = [];
    bar.setAttribute("aria-label", "组件排序");
    metrics.append(el("span", null, "按"));
    function sortButton(container, label, select) {
      const button = el("button", "l", label);
      button.type = "button";
      button.addEventListener("click", select);
      container.append(button);
      return button;
    }
    function updateSort() {
      const { metric, directions: remembered } = state.sorting;
      for (const [value, button] of metricButtons)
        button.setAttribute("aria-pressed", String(value === metric));
      for (const [value, button] of directionButtons) {
        button.textContent =
          metric === "collects"
            ? value === "desc"
              ? "从多到少"
              : "从少到多"
            : value === "desc"
              ? "从新到旧"
              : "从旧到新";
        button.setAttribute(
          "aria-pressed",
          String(value === remembered[metric]),
        );
      }
      for (const item of state.orderedItems) ul.append(nodes.get(item.id));
    }
    for (const [metric, label] of [
      ["collects", "热门程度"],
      ["created", "创建日期"],
      ["updated", "更新日期"],
    ]) {
      metricButtons.set(
        metric,
        sortButton(metrics, label, () => {
          changeSort(metric);
          updateSort();
        }),
      );
    }
    metrics.append(el("span", null, "排序"));
    for (const direction of ["desc", "asc"]) {
      directionButtons.set(
        direction,
        sortButton(directions, "", () => {
          changeSort(state.sorting.metric, direction);
          updateSort();
        }),
      );
    }
    bar.append(metrics, directions);
    list.append(bar, ul);
    for (const item of state.items) {
      const li = el("li", "clearit tml_item");
      li.dataset.userGadgetsItem = item.id;
      const icon = el("span", "avatar"),
        info = el("span", "info clearit");
      const link = (href, text, cls = "l") => {
        const a = el("a", cls, text);
        a.href = href;
        return a;
      };
      if (item.icon) {
        const a = link(item.href, null, "avatar"),
          img = el("img", "avatar");
        img.src = item.icon;
        img.alt = item.title;
        img.width = 40;
        a.append(img);
        icon.append(a);
      }
      const h3 = el("h3");
      h3.append(
        el("span", "badge_job", "组件"),
        document.createTextNode(" "),
        link(item.href, item.title, "title l"),
      );
      info.append(h3);
      const meta = el("span", "tip_i");
      meta.append(link(item.authorHref, item.authorName));
      if (item.created.text)
        meta.append(
          document.createTextNode(" 创建于 "),
          el("span", "tip_j attr_timestamp", item.created.text),
        );
      if (item.updated.text)
        meta.append(
          document.createTextNode(" · 更新 "),
          el("span", "tip_j attr_lasttouch", item.updated.text),
        );
      if (item.collects != null)
        meta.append(
          document.createTextNode(" · "),
          el("span", "tip_j attr_collects", item.collects),
          document.createTextNode(" 人启用"),
        );
      info.append(meta);
      const desc = el("p", "desc");
      for (const part of item.description)
        desc.append(
          part.break
            ? el("br")
            : part.href
              ? link(part.href, part.text)
              : document.createTextNode(part.text),
        );
      info.append(desc);
      for (const warning of item.warnings) {
        const p = el("p");
        p.append(el("span", "alarm", warning));
        info.append(p);
      }
      const tags = el("div", "item-tags");
      item.tags.forEach((tag, index) => {
        const badge = el("span", "badge_tag", tag);
        if (state.categories) {
          badge.setAttribute("role", "button");
          badge.tabIndex = 0;
          const select = () => {
            state.catalog.cardTag(state.filters, item, index);
            updateFilters();
          };
          badge.addEventListener("click", select);
          badge.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              select();
            }
          });
        }
        tags.append(badge);
      });
      info.append(tags);
      li.append(icon, info);
      nodes.set(item.id, li);
      for (const target of [h3.querySelector("a"), desc, ...tags.children])
        highlights.push(highlighter(document, target));
    }
    const empty = el("p", "tip", "没有符合当前条件的组件");
    empty.setAttribute("role", "status");
    list.append(empty);
    const controls = renderFilters(el, tools, state, timers, updateFilters);
    function updateFilters() {
      let any = false;
      for (const item of state.items) {
        const node = nodes.get(item.id);
        node.hidden = !state.catalog.matches(item, state.filters);
        any ||= !node.hidden;
        [...node.querySelectorAll(".badge_tag")].forEach((tag, index) => {
          const selected = state.catalog.tagSelected(
            state.filters,
            item,
            index,
          );
          tag.classList.toggle("highlighted", selected);
          if (state.categories)
            tag.setAttribute("aria-pressed", String(selected));
        });
      }
      empty.hidden = any;
      for (const highlight of highlights) highlight(state.filters.query);
      controls.update();
    }
    updateSort();
    updateFilters();
    return controls.dispose;
  }

  function renderFilters(el, tools, state, timers, changed) {
    const { catalog, filters } = state;
    const searchBox = el("div", "sideInner ug-search"),
      search = el("div", "search"),
      searchBar = el("div", "searchBar"),
      inner = el("div", "inner"),
      input = el("input", "textfield");
    input.type = "text";
    input.setAttribute("aria-label", "搜索组件");
    input.placeholder = "输入关键词 (标题 / 描述 / 标签)";
    input.value = filters.query;
    searchBox.append(el("h2", "subtitle", "搜索组件"), search);
    search.append(searchBar);
    searchBar.append(inner);
    inner.append(input);
    tools.append(searchBox);
    let pending = null,
      composing = false;
    const cancel = () => {
      timers.clearTimeout(pending);
      pending = null;
    };
    const apply = () => {
      cancel();
      filters.query = input.value;
      changed();
    };
    input.addEventListener("input", (event) => {
      cancel();
      if (!composing && !event.isComposing)
        pending = timers.setTimeout(apply, 180);
    });
    input.addEventListener("compositionstart", () => {
      composing = true;
      cancel();
    });
    input.addEventListener("compositionend", () => {
      composing = false;
      cancel();
      pending = timers.setTimeout(apply, 180);
    });
    input.addEventListener("keydown", (event) => {
      if (composing || event.isComposing || event.keyCode === 229) return;
      if (event.key === "Enter") {
        event.preventDefault();
        apply();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        input.value = "";
        apply();
      }
    });
    const section = el("div", "sideInner ug-filter"),
      heading = el("h2", "subtitle", "组件筛选");
    section.append(heading);
    tools.append(section);
    if (!state.categories) {
      section.append(el("p", "tip", "分类配置暂不可用"));
      return { update() {}, dispose: cancel };
    }
    const reset = el("button", "ug-reset rr l");
    reset.type = "button";
    reset.append(el("small", null, "重置"));
    heading.append(reset);
    reset.addEventListener("click", () => {
      filters.category = null;
      filters.tags = [];
      changed();
    });
    const categoryInputs = new Map(),
      relatedInputs = new Map(),
      groups = new Map(),
      related = el("div", "related-tags-container"),
      relatedTags = el("div", "related-tags-wrapper");
    related.append(el("h3", "related-tags-title", "关联标签"), relatedTags);
    function option(container, name, count, type, select) {
      const label = el("label", "tag-checkbox"),
        control = el("input");
      control.type = type;
      if (type === "radio") control.name = "user-gadgets-category";
      label.append(
        control,
        el("span", "ug-option-name", name),
        el("span", "tag-count", count),
      );
      control.addEventListener("click", select);
      container.append(label);
      return control;
    }
    for (const category of catalog.categories) {
      let container;
      if (category.parent) container = groups.get(category.parent);
      else {
        const group = el("div", "main-category");
        section.append(group);
        container = group;
        const children = el("div", "sub-categories");
        groups.set(category.key, children);
        group.append(children);
      }
      const control = option(
        container,
        category.label,
        category.count,
        "radio",
        () => {
          catalog.selectCategory(filters, category.key);
          changed();
        },
      );
      if (!category.parent) container.prepend(control.parentElement);
      categoryInputs.set(category.key, control);
    }
    section.append(related);
    function update() {
      reset.hidden = filters.category === null;
      for (const [key, control] of categoryInputs) {
        control.checked = filters.category === key;
        control.parentElement.classList.toggle("selected", control.checked);
      }
      related.hidden = filters.category === null;
      const options = catalog.related(filters);
      if (
        JSON.stringify([...relatedInputs.keys()]) !==
        JSON.stringify(options.map((o) => o.tag))
      ) {
        relatedTags.replaceChildren();
        relatedInputs.clear();
        for (const { tag, count } of options)
          relatedInputs.set(
            tag,
            option(relatedTags, tag, count, "checkbox", () => {
              catalog.selectTag(filters, tag);
              changed();
            }),
          );
      }
      for (const { tag, count, selected, disabled } of options) {
        const control = relatedInputs.get(tag);
        control.parentElement.querySelector(".tag-count").textContent = count;
        control.checked = selected;
        control.disabled = disabled;
        control.parentElement.classList.toggle("selected", selected);
        control.parentElement.classList.toggle("ug-disabled", disabled);
      }
    }
    return { update, dispose: cancel };
  }

  const applications = new WeakMap();
  function startApp({
    window,
    fetch = window.fetch.bind(window),
    timers = window,
    now = () => Date.now(),
  }) {
    if (applications.has(window.document))
      return applications.get(window.document);
    const d = window.document,
      sessions = new Map();
    let mounted = null,
      current = null,
      pending = null,
      generation = 0,
      stopped = false,
      entry = null,
      errorNode = null,
      disposeView = null;
    function clearError() {
      errorNode?.remove();
      errorNode = null;
    }
    function fail(host) {
      clearError();
      errorNode = d.createElement("p");
      errorNode.dataset.userGadgetsError = "";
      errorNode.setAttribute("role", "alert");
      errorNode.textContent = host.reason;
      host.nav.after(errorNode);
    }
    function ensureEntry(host) {
      if (!host || host.reason) return;
      entry = host.nav.querySelector("[data-user-gadgets-link]");
      if (entry) return;
      entry = d.createElement("li");
      entry.dataset.userGadgetsLink = "";
      const a = d.createElement("a");
      a.href = "#gadgets";
      a.textContent = "组件";
      entry.append(a);
      host.group.parentElement.after(entry);
      a.addEventListener("click", onClick);
    }
    function onClick(event) {
      if (
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      if (window.location.hash === "#gadgets") {
        event.preventDefault();
        if (!mounted) schedule();
      }
    }
    function publish(state) {
      if (
        !mounted ||
        current !== state ||
        stopped ||
        window.location.hash !== "#gadgets"
      )
        return;
      disposeView?.();
      disposeView = renderView(
        d,
        mounted.root,
        state,
        () => {
          if (state.status !== "error" || now() < (state.error.retryAt || 0))
            return;
          load(state);
        },
        now,
        (metric, direction) => {
          state.sorting.metric = metric;
          if (direction) state.sorting.directions[metric] = direction;
          state.orderedItems = sortItems(state.orderedItems, state.sorting);
        },
        timers,
      );
    }
    function load(state) {
      state.status = "loading";
      state.error = null;
      publish(state);
      state.task = readGarage(
        { window, fetch, timers, now },
        window.location.origin,
      )
        .then(
          (garage) => {
            state.items = authorItems(garage, state.user);
            state.orderedItems = sortItems(state.items, state.sorting);
            state.categories = garage.categories;
            state.catalog = createCatalog(state.items, state.categories);
            state.status = "success";
          },
          (error) => {
            state.status = "error";
            state.error = error;
          },
        )
        .then(() => {
          state.task = null;
          publish(state);
        });
    }
    function enter() {
      if (stopped || mounted || window.location.hash !== "#gadgets") return;
      const host = inspectHost(window, true);
      if (!host) return;
      if (host.reason) {
        fail(host);
        return;
      }
      ensureEntry(host);
      clearError();
      mounted = mountHost(window, host, entry.querySelector("a"));
      let state = sessions.get(host.user);
      if (!state) {
        state = {
          user: host.user,
          status: "idle",
          items: [],
          orderedItems: [],
          sorting: createSorting(),
          filters: createFilters(),
        };
        sessions.set(host.user, state);
      }
      current = state;
      if (state.status === "idle") load(state);
      else publish(state);
    }
    function exit() {
      disposeView?.();
      disposeView = null;
      mounted?.hide();
      mounted = current = null;
      clearError();
    }
    function schedule() {
      const token = ++generation;
      if (pending !== null) timers.clearTimeout(pending);
      pending = timers.setTimeout(() => {
        pending = null;
        if (token === generation) enter();
      }, 0);
    }
    function route() {
      if (window.location.hash !== "#gadgets") exit();
      schedule();
    }
    // Exit synchronously before other virtual pages mount; enter in the next task.
    window.addEventListener("hashchange", route, true);
    const initial = inspectHost(window);
    ensureEntry(initial);
    if (window.location.hash === "#gadgets") schedule();
    const app = {
      stop() {
        stopped = true;
        generation++;
        if (pending !== null) timers.clearTimeout(pending);
        window.removeEventListener("hashchange", route, true);
        exit();
        entry?.querySelector("a")?.removeEventListener("click", onClick);
        entry?.remove();
        applications.delete(d);
      },
    };
    applications.set(d, app);
    return app;
  }

  startApp({ window });
})();
