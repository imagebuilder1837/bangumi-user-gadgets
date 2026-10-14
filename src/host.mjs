const userPath =
  /^\/user\/([^/]+)(?:\/(blog|index|friends|rev_friends|timeline|mono|groups|wiki)(?:\/[^/]+)*)?\/?$/;
const collectionPath =
  /^\/(anime|book|music|game|real)\/list\/([^/]+)(?:\/(wish|collect|do|on_hold|dropped))?\/?$/;

export function inspectHost(window, takeover = false) {
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
            decodeURIComponent(new URL(a.href).pathname).replace(/\/$/, "") ===
              `/user/${user}`
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
  const containsFocus = (value) => (value || "").split(/\s+/).includes("focus");
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

export function mountHost(w, host, link) {
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
