export function renderView(document, root, state, retry, now, changeSort) {
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
      button.setAttribute("aria-pressed", String(value === remembered[metric]));
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
