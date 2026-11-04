// Mounts a real Hello, World Cup page (the TV, a player's join page, or the officers' test page) inside the hello-world
// Layout, in a memory router, on host-layout-convex.jsx's local store. rounds.spec.ts swaps their Convex and Clerk
// imports for that store, so the pages run offline; only Pyodide's CDN is reached, for real Python.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Outlet, RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { FeedbackProvider } from "../../src/components/feedback";
import { reset } from "./host-layout-convex.jsx";

const PAGES = {
  tv: () => import("../../src/routes/hello-world/tv.tsx?tsr-split=component"),
  join: () => import("../../src/routes/hello-world/join.tsx?tsr-split=component"),
  test: () => import("../../src/routes/hello-world/test.tsx?tsr-split=component"),
};

export async function mount(page, scenario) {
  const [{ component: Layout }, { component: Page }] = await Promise.all([
    import("../../src/routes/hello-world/route.tsx?tsr-split=component"),
    PAGES[page](),
  ]);
  reset(scenario);
  // The join page finds its player by the token this browser saved when it joined.
  localStorage.setItem("hwc.token.session-local", "token-1");
  const root = createRootRoute({ component: Outlet });
  const layout = createRoute({ getParentRoute: () => root, path: "/hello-world", component: Layout });
  const route = createRoute({ getParentRoute: () => layout, path: `/${page}`, component: Page, validateSearch: (s) => s });
  const router = createRouter({
    routeTree: root.addChildren([layout.addChildren([route])]),
    history: createMemoryHistory({ initialEntries: [`/hello-world/${page}`] }),
    defaultPreload: false,
  });
  const element = document.createElement("div");
  element.id = "rounds-mount";
  document.body.append(element);
  createRoot(element).render(
    <StrictMode>
      <FeedbackProvider>
        <RouterProvider router={router} />
      </FeedbackProvider>
    </StrictMode>,
  );
}
