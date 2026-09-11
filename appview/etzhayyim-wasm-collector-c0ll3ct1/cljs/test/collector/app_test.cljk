(ns collector.app-test
  (:require [cljs.test :refer [deftest is testing]]
            [re-frame.core :as rf]
            [collector.app :as app]))

(deftest default-db-matches-original-scaffold-literal
  (testing "app-db data holds the exact field values the original
            +page.svelte's <script> const held, before the migration"
    (is (= "Collector C0ll3ct1" (:app/title app/default-db)))
    (is (= "etzhayyim-project-collector" (:app/project app/default-db)))
    (is (= "etzhayyim-wasm-collector-c0ll3ct1" (:app/name app/default-db)))
    (is (= "appview" (:app/kind app/default-db)))
    (is (= 0 (:app/route-count app/default-db)))
    (is (= [] (:app/routes app/default-db)))
    (is (= [] (:app/vars app/default-db)))
    (is (true? (:app/xrpc? app/default-db)))
    (is (= (str "60-apps/etzhayyim-project-collector/appview/"
                "etzhayyim-wasm-collector-c0ll3ct1/svelte/src/routes/+page.svelte")
           (:app/relative-path app/default-db)))))

(deftest initialize-db-event-sets-all-subs
  (testing "dispatching :initialize-db makes every reg-sub resolve to
            default-db's matching value"
    (rf/dispatch-sync [:initialize-db])
    (is (= (:app/title app/default-db) @(rf/subscribe [:app/title])))
    (is (= (:app/project app/default-db) @(rf/subscribe [:app/project])))
    (is (= (:app/name app/default-db) @(rf/subscribe [:app/name])))
    (is (= (:app/kind app/default-db) @(rf/subscribe [:app/kind])))
    (is (= (:app/route-count app/default-db) @(rf/subscribe [:app/route-count])))
    (is (= (:app/routes app/default-db) @(rf/subscribe [:app/routes])))
    (is (= (:app/vars app/default-db) @(rf/subscribe [:app/vars])))
    (is (= (:app/xrpc? app/default-db) @(rf/subscribe [:app/xrpc?])))
    (is (= (:app/relative-path app/default-db) @(rf/subscribe [:app/relative-path])))))

(deftest initialize-db-is-idempotent
  (testing "dispatching :initialize-db twice leaves subs unchanged"
    (rf/dispatch-sync [:initialize-db])
    (rf/dispatch-sync [:initialize-db])
    (is (= (:app/title app/default-db) @(rf/subscribe [:app/title])))
    (is (= (:app/route-count app/default-db) @(rf/subscribe [:app/route-count])))))
