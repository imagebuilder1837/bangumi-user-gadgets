export function authorItems(garage, user) {
  return garage.items.filter((item) => item.author === user);
}

export function createFilters() {
  return { query: "", category: null, tags: [] };
}

function fold(text) {
  return text.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

export function searchTerms(query) {
  return fold(query).split(/\s+/u).filter(Boolean);
}

export function searchRanges(text, query) {
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

export function createCatalog(items, configuration) {
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
    return category === null || role.main === category || role.sub === category;
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

export function createSorting() {
  return {
    metric: "collects",
    directions: { collects: "desc", created: "desc", updated: "desc" },
  };
}

export function sortItems(items, sorting) {
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
