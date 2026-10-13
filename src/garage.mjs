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
          u && new RegExp(`^/dev/app/${id}/(enable|disable)$`).test(u.pathname),
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

export async function readGarage({ window, fetch, timers, now }, origin) {
  const wait = (ms) => new Promise((resolve) => timers.setTimeout(resolve, ms));
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
