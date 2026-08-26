# collector

`cloud-itonami/collector` は、**公開 OSINT / ネットワーク情報**（DNS 観測・RDAP・
ブロックチェーン actor・リスクシグナル）を収集し、AT PDS レコードとして記録する
app プロジェクトである。

配備先として宣言されているホストは `collector.etzhayyim.com`。
**2026-08-19 時点でそのホスト名に A レコードは無く、live ではない**
（実測手順は [`docs/operator-quickstart.md`](docs/operator-quickstart.md) step 6）。

## 何が入っているか（tracked 26 ファイル）

| 場所 | 中身 |
|---|---|
| `kotoba/` | public レジストリの TS 実装（`registry.ts` / `types.ts`）と vitest スイート |
| `appview/etzhayyim-wasm-collector-c0ll3ct1/` | reagent + re-frame + jp-go-dds（`cljs/`）+ Cloudflare Worker の edge facade（`src/app.ts`）。2026-08-26 に Svelte から移行 |
| `config/targets.json` | 収集対象 — 15 ドメイン・10 IP・6 レコード型 |
| `CLAUDE.md` | 実装の内側（XRPC service 定義・Kysely/RisingWave の保管経路・グラフモデル） |

## 4 つの公開コレクション

`kotoba/src/index.ts` が export する API は 4 コレクションに対応する。
いずれも AT PDS レコードで、collection NSID は `com.etzhayyim.apps.collector.*`。

| コレクション | API | did |
|---|---|---|
| `collectorRun` | `startRun` / `finishRun` / `listRuns` | `did:web:collector.etzhayyim.com:run:{runId}` |
| `dnsObservation` | `recordDns` / `listDns` | `…:dns:{observationId}` |
| `blockchainActor` | `recordActor` / `listActors` | `…:actor:{actorId}` |
| `riskSignal` | `recordSignal` / `listSignals` | `…:signal:{signalId}` |

横断集計は `coverage`。

**custody の分割（ADR-2606011400 / ADR-2605172400）**: 公開の観測とシグナル
メタデータだけが substrate に載る。生の漏洩データベース内容（`leakEntity`）と
abuse report の被害者・通報者 PII（`abuseReport`）は **etzhayyim 側インフラに
留まり**、consent-capability 経由でのみ参照される。これらの公開レコードに
生の breach PII を書いてはならない。

## 収集源

`types.ts` の `CollectorSource` は 6 つを挙げる:
`rdap` / `dns` / `blockchain` / `commonCrawl` / `portScan` / `internetArchive`。

**このうち到達性を実測できているのは `dns` と `rdap` の 2 つだけ**である
（quickstart step 5 が DNS 解決と IANA / rdap.org / ARIN の RDAP を 200 で引く）。
残る 4 つは型として在るだけで、この repo に endpoint も資格情報も無い。

## 動かす

**宣言されている `npm test` は走らない。** git 依存 `@etzhayyim/sdk` の
`prepare` script を npm 11 が拒否する（`EALLOWSCRIPTS`）。

だが**スイート自体は走る** —— 実行時に必要なのは import を持たない単一ファイルの
`@etzhayyim/sdk-mock` だけで、`@etzhayyim/sdk` への参照は `import type` なので
消える。vitest と mock ソースへの alias があれば **4/4 緑**になる。

手順・期待出力・変異による検証は [`docs/operator-quickstart.md`](docs/operator-quickstart.md)。
所要 10 分で、`git` / `node` / `npm` / `dig` / `curl` 以外は要らない。

## 既知の欠落（実測済み・推測ではない）

- **テストが見張っていない reject パスが 3 本**: `invalidSeverity` /
  `invalidSubjectType` / `itemsCollectedMustBeNonNegInt`。実装はこれらを
  拒否するが、スイートは妥当な値しか渡していないので拒否を一度も観測して
  いない（quickstart step 4 の変異 M5〜M7 が緑のまま）。
- **`/health` は配備物に無いままの可能性がある（UNVERIFIED）**: `/health` と
  `/_app/meta` を持つのは `appview/*/src/app.ts` だけ。2026-08-26 の
  Svelte→ClojureScript 移行で `wrangler.jsonc` の `main`（旧: SvelteKit の
  ビルド成果物）は削除し、`assets.directory` を `./cljs/public` に向け直した
  （`src/app.ts` へは付け替えていない — `env.ASSETS.fetch()` を呼ばないため）。
  したがって `main` 不在の今も `/health` は依然として `src/app.ts` にしかない。
  workspace の検出器 `scripts/verify-appview-facade.cljs` を移行後の tree に
  対して再実行して確かめてはいない（`docs/operator-quickstart.md` step 6 参照）。
- 移行の残件は [`MIGRATION-TODO.md`](MIGRATION-TODO.md) と `migration.edn`
  （これらは AT Protocol 移行についての別件で、Svelte→ClojureScript のフロント
  エンド移行とは無関係）。
