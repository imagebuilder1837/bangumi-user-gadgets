import { inspectHost, mountHost } from "./host.mjs";
import { readGarage, toggleGadget } from "./garage.mjs";
import {
  authorItems,
  createSorting,
  sortItems,
  createFilters,
  createCatalog,
} from "./model.mjs";
import { renderView } from "./view.mjs";

const applications = new WeakMap();
export function startApp({
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
    errorNode = null,
    view = null;
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
    view?.dispose();
    view = renderView(
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
      timers,
      (id) => act(state, id),
    );
  }
  function updateAction(state, id) {
    if (
      mounted &&
      current === state &&
      !stopped &&
      window.location.hash === "#gadgets"
    )
      view?.updateAction(id);
  }
  async function act(state, id) {
    const action = state.actions.get(id);
    if (
      !action ||
      action.status === "pending" ||
      stopped ||
      current !== state ||
      window.location.hash !== "#gadgets"
    )
      return;
    timers.clearTimeout(action.recovery);
    action.status = "pending";
    updateAction(state, id);
    const ok = await toggleGadget({ window, fetch, timers }, action.href);
    if (ok) {
      const url = new URL(action.href);
      url.pathname = url.pathname.replace(
        /\/(enable|disable)$/,
        action.enabling ? "/disable" : "/enable",
      );
      action.href = url.href;
      action.enabling = !action.enabling;
      action.status = "idle";
    } else {
      action.status = "error";
      action.recovery = timers.setTimeout(() => {
        action.status = "idle";
        updateAction(state, id);
      }, 2000);
    }
    updateAction(state, id);
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
          state.actions = new Map(
            state.items
              .filter((item) => item.action)
              .map((item) => [
                item.id,
                {
                  href: item.action,
                  enabling: new URL(item.action).pathname.endsWith("/enable"),
                  status: "idle",
                },
              ]),
          );
          state.orderedItems = sortItems(state.items, state.sorting);
          state.categories = garage.categories;
          state.catalog = createCatalog(state.items, state.categories);
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
        filters: createFilters(),
      };
      sessions.set(host.user, state);
    }
    current = state;
    if (state.status === "idle") load(state);
    else publish(state);
  }
  function exit() {
    view?.dispose();
    view = null;
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
