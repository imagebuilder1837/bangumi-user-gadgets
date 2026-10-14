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
[data-user-gadgets-view] .ug-sort { display:flex;flex-wrap:wrap;align-items:baseline;gap:4px; }
[data-user-gadgets-view] .ug-sort .filters { display:flex;flex-wrap:wrap;align-items:baseline;gap:2px; }
[data-user-gadgets-view] .ug-sort-directions { margin-left:auto; }
[data-user-gadgets-view] .ug-sort button.l { appearance:none;border:0;background:none;color:#0084b4;font:inherit;cursor:pointer;border-radius:15px;padding:2px 8px; }
html[data-theme=dark] [data-user-gadgets-view] .ug-sort button.l { color:#2ea6ff; }
[data-user-gadgets-view] .ug-sort button[aria-pressed=true],[data-user-gadgets-view] .ug-sort button:hover,[data-user-gadgets-view] .ug-sort button:focus-visible { background:var(--primary-color,#f09199);color:#fff; }
[data-user-gadgets-view] .ug-sort button:focus-visible { outline:2px solid currentColor;outline-offset:2px; }
[data-user-gadgets-view] .gadgetList { margin:0;padding:0;list-style:none; }
[data-user-gadgets-view] .gadgetList li { display:flex;padding:5px 0;border-bottom:1px solid rgba(128,128,128,.2);gap:18px; }
[data-user-gadgets-view] .gadgetList .avatar img { width:40px;height:40px;border-radius:5px; }
[data-user-gadgets-view] .gadgetList .info { flex:1;min-width:0; }
[data-user-gadgets-view] .desc { white-space:pre-wrap;overflow-wrap:anywhere;margin:5px 0; }
[data-user-gadgets-view] .item-tags { display:flex;flex-wrap:wrap;gap:3px; }
[data-user-gadgets-view] .badge_tag { padding:2px 5px;background:rgba(128,128,128,.12);border-radius:3px;color:inherit; }
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
      if (n.tagName === "BR") return [{ text: "\n" }];
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

  function renderView(document, root, state, retry, now, changeSort) {
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
      ul = el("ul", "gadgetList list_all"),
      nodes = new Map(),
      metricButtons = new Map(),
      directionButtons = new Map();
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
        meta.append(document.createTextNode(` 创建于 ${item.created.text}`));
      if (item.updated.text)
        meta.append(document.createTextNode(` · 更新 ${item.updated.text}`));
      if (item.collects != null)
        meta.append(document.createTextNode(` · ${item.collects} 人启用`));
      info.append(meta);
      const desc = el("p", "desc");
      for (const part of item.description)
        desc.append(
          part.href
            ? link(part.href, part.text)
            : document.createTextNode(part.text),
        );
      info.append(desc);
      const tags = el("div", "item-tags");
      item.tags.forEach((tag) => tags.append(el("span", "badge_tag", tag)));
      info.append(tags);
      li.append(icon, info);
      nodes.set(item.id, li);
    }
    updateSort();
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
      errorNode = null;
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
      renderView(
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
        };
        sessions.set(host.user, state);
      }
      current = state;
      if (state.status === "idle") load(state);
      else publish(state);
    }
    function exit() {
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
