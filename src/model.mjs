export function authorItems(garage, user) {
  return garage.items.filter((item) => item.author === user);
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
