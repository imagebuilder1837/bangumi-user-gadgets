import { searchRanges } from "./model.mjs";

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

export function renderView(
  document,
  root,
  state,
  retry,
  now,
  changeSort,
  timers,
) {
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
        const selected = state.catalog.tagSelected(state.filters, item, index);
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
