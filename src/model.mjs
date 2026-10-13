export function authorItems(garage, user) {
  return garage.items.filter((item) => item.author === user);
}
