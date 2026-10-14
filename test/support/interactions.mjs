export const viewRoot = (document) =>
  document.querySelector("[data-user-gadgets-view]");

export const viewQuery = (document, selector) =>
  viewRoot(document)?.querySelector(selector) ?? null;

export const visibleItems = (document) =>
  [...viewRoot(document).querySelectorAll("[data-user-gadgets-item]")]
    .filter((node) => !node.hidden)
    .map((node) => node.dataset.userGadgetsItem);

export const filterOption = (document, name, type = "radio") =>
  [...viewRoot(document).querySelectorAll(`input[type=${type}]`)].find(
    (node) =>
      node.closest("label").querySelector(".ug-option-name").textContent ===
      name,
  );

export const searchInput = (document) =>
  viewQuery(document, 'input[aria-label="搜索组件"]');

// Event sequences stay with the scenario (input/Enter, keydown-only, IME).
export function setSearchValue(document, value) {
  const input = searchInput(document);
  input.value = value;
  return input;
}
