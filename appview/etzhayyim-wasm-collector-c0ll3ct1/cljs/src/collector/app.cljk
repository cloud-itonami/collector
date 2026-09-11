(ns collector.app
  "Collector appview frontend shell.

  Migrated from the Svelte/Vite scaffold at
  `appview/etzhayyim-wasm-collector-c0ll3ct1/svelte` — a single
  `src/routes/+page.svelte` (~84 lines) that held a static `app` object
  literal (title/project/name/kind/routeCount/routes/vars/xrpc/
  relativePath) as a <script> const and rendered it with no fetch, no
  interactivity, no client-side routing — to reagent + re-frame, rendered
  with `jp-go-dds.core` (デジタル庁デザインシステム) hiccup.

  The scaffold's *other* route,
  `svelte/src/routes/xrpc/[...path]/+server.ts`, is a real HTTP backend
  handler (a SvelteKit server route that proxied XRPC POSTs to the MCP
  router as JSON-RPC `tools/call` requests) — not frontend. It moved
  byte-identical to
  `appview/etzhayyim-wasm-collector-c0ll3ct1/src/xrpc-mcp-router-proxy.ts`
  with a provenance header explaining it will not run as-is now that
  SvelteKit (and therefore its `./$types` and `@sveltejs/kit` request
  event) is gone. It is unaffected by, and not referenced from, this
  namespace.

  The 5 static fields the original page held (`title` / `project` /
  `name` / `kind` / `relativePath`) plus the 3 empty/zero fields
  (`routeCount` 0, `routes` [], `vars` []) and `xrpc` true are carried
  over unchanged as re-frame app-db data below, so there is real
  event/sub logic instead of a compiled-in <script> literal, and so the
  conditional branches the original template had (`{#if app.routes.length}`
  / `{#if app.vars.length}`) still have somewhere to branch on.

  `public/index.html`'s inlined <style> was produced once, at authoring
  time, by `jp-go-dds.page/->page` running on the JVM (via this deps.edn's
  jp-go-dds git/sha), concatenating the vendored `dds.css` with
  `jp-go-dds.core/ext-css` — exactly what `jp-go-dds.page/page` composes
  for its own <style> block. This namespace itself only requires
  `jp-go-dds.core` — the browser bundle does not need `jp-go-dds.page` or
  `html.core` at runtime; those are JVM-only tools used to author the
  static shell once. Regenerate that shell (e.g. if jp-go-dds's core
  components or ext-rules change) with:

    (require '[jp-go-dds.page :as page] '[clojure.java.io :as io])
    (spit \"public/index.html\"
          (page/->page {:title \"etzhayyim-wasm-collector-c0ll3ct1\"
                         :description \"Collector appview frontend shell (reagent + re-frame + jp-go-dds).\"
                         :css (slurp (io/resource \"jp_go_dds/dds.css\"))}
                        [:div {:id \"app\"}]
                        [:script {:src \"js/app.js\"}]))"
  (:require [reagent.dom :as rdom]
            [re-frame.core :as rf]
            [jp-go-dds.core :as dds]))

;; --- state ------------------------------------------------------------------

(def default-db
  "The `app` object literal the original +page.svelte's <script> block held
  as a compiled-in const (not fetched, not computed — the same values were
  present at every render), now held as re-frame app-db data instead so
  there is real event/sub logic to test. Field names and values are
  unchanged from the Svelte source's `app.title` / `app.project` /
  `app.name` / `app.kind` / `app.routeCount` / `app.routes` / `app.vars` /
  `app.xrpc` / `app.relativePath`."
  {:app/title "Collector C0ll3ct1"
   :app/project "etzhayyim-project-collector"
   :app/name "etzhayyim-wasm-collector-c0ll3ct1"
   :app/kind "appview"
   :app/route-count 0
   :app/routes []
   :app/vars []
   :app/xrpc? true
   :app/relative-path
   "60-apps/etzhayyim-project-collector/appview/etzhayyim-wasm-collector-c0ll3ct1/svelte/src/routes/+page.svelte"})

(rf/reg-event-db
 :initialize-db
 (fn [_ _] default-db))

(rf/reg-sub :app/title (fn [db _] (:app/title db)))
(rf/reg-sub :app/project (fn [db _] (:app/project db)))
(rf/reg-sub :app/name (fn [db _] (:app/name db)))
(rf/reg-sub :app/kind (fn [db _] (:app/kind db)))
(rf/reg-sub :app/route-count (fn [db _] (:app/route-count db)))
(rf/reg-sub :app/routes (fn [db _] (:app/routes db)))
(rf/reg-sub :app/vars (fn [db _] (:app/vars db)))
(rf/reg-sub :app/xrpc? (fn [db _] (:app/xrpc? db)))
(rf/reg-sub :app/relative-path (fn [db _] (:app/relative-path db)))

;; --- view ---------------------------------------------------------------

(defn- top-section
  "Mirrors the original `<section class=\"top\">`: a small uppercase kind
  label (`Cloudflare {app.kind}`), the h1 title, and the monospace name
  span underneath it."
  []
  [:section {:class "dds-ext-stack"}
   [:p {:class "dds-ext-lead"} (str "Cloudflare " @(rf/subscribe [:app/kind]))]
   (dds/heading 1 @(rf/subscribe [:app/title]))
   [:span @(rf/subscribe [:app/name])]])

(defn- facts-section
  "Mirrors the original `<section class=\"facts\">`'s 3-column grid of
  label/value pairs: Project, Routes (routeCount), XRPC (enabled/not
  configured)."
  []
  [:section {:class "dds-ext-grid"}
   (dds/card [:span "Project"] [:strong @(rf/subscribe [:app/project])])
   (dds/card [:span "Routes"] [:strong (str @(rf/subscribe [:app/route-count]))])
   (dds/card [:span "XRPC"]
             [:strong (if @(rf/subscribe [:app/xrpc?]) "enabled" "not configured")])])

(defn- public-routes-panel
  "Mirrors the original `{#if app.routes.length}` branch: a list of routes,
  or a muted fallback paragraph when none are declared."
  []
  (let [routes @(rf/subscribe [:app/routes])]
    (dds/section
     {:title "Public Routes"}
     (if (seq routes)
       (into [:ul {:class "dds-ext-stack"}] (map (fn [route] [:li route])) routes)
       [:p {:class "dds-ext-lead"}
        "No public route is declared next to this app surface."]))))

(defn- runtime-bindings-panel
  "Mirrors the original `{#if app.vars.length}` branch: a chip per declared
  wrangler var, or a muted fallback paragraph when none are declared."
  []
  (let [vars @(rf/subscribe [:app/vars])]
    (dds/section
     {:title "Runtime Bindings"}
     (if (seq vars)
       (into [:div {:class "dds-ext-row"}] (map (fn [k] (dds/chip-label k))) vars)
       [:p {:class "dds-ext-lead"}
        "No public vars are declared in the nearest wrangler config."]))))

(defn- source-panel
  "Mirrors the original `<section class=\"panel path\">`: the source file's
  relative path."
  []
  (dds/section {:title "Source"} [:p @(rf/subscribe [:app/relative-path])]))

(defn app []
  [:main {:class "dds-ext-container"}
   [top-section]
   [facts-section]
   [public-routes-panel]
   [runtime-bindings-panel]
   [source-panel]])

;; --- mount ------------------------------------------------------------------

(defn render []
  (rdom/render [app] (.getElementById js/document "app")))

(defn ^:export main []
  (rf/dispatch-sync [:initialize-db])
  (render))
