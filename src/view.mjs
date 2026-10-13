export function renderView(document, root, state, retry, now) {
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
  const ul = el("ul", "gadgetList list_all");
  list.append(ul);
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
    ul.append(li);
  }
}
