# operator quickstart — collector

**この文書の約束**: ここに書いた手順は全部、書いたあとで **fresh clone に対して逐語で
踏み直してある**。踏めなかった手順は載せていない。落ちる手順は「落ちる」と書き、
その落ち方まで載せている —— 落ちること自体がこの repo についての事実だから。

実測日 2026-08-19 / 対象 commit `ba3e3bd` /
macOS 26.3 arm64・node v26.3.0・npm 11.16.0。必要なのは `git` / `node` / `npm` /
`dig` / `curl` だけ。

⚠ `core.fsmonitor=true` を設定している環境では、git コマンドが stderr に
`error: could not read IPC response` を混ぜることがある（fsmonitor デーモンの
不調で、負荷の高いマシンで出る）。**このメッセージは stdout の値に影響しない** ——
以下の期待出力はどれも stdout であり、この行が挟まっても一致する。

所要 10 分。**step 3 がこの repo で唯一「実際に動く」実行経路**なので、時間が
無ければ step 1 → 2 → 3 だけでよい。

この repo が何であるかは [`README.md`](../README.md)、実装の内側は
[`CLAUDE.md`](../CLAUDE.md)。この文書は**外から踏める手順だけ**を扱う。

---

## step 1 — tree を取って、いま何を見ているかを確定する

```bash
git clone --quiet git@github.com:cloud-itonami/collector.git /tmp/collector-walk
cd /tmp/collector-walk
git checkout --quiet ba3e3bd        # ← この文書が測った commit に固定する
git log -1 --format='%h %cI'
git ls-files | wc -l | tr -d ' '
```

期待:

```
ba3e3bd 2026-07-20T01:43:37+09:00
26
```

**`git checkout ba3e3bd` を飛ばさないこと。** この文書自身が `main` に載っている
ので、`main` の tracked file 数は 26 より多い。step 2〜6 の期待出力は `ba3e3bd`
に対する実測であり、そこに固定して初めて逐語で一致する。`main` の側で歩きたい
場合は、数だけが増えて中身の判定（step 2〜6）は変わらない —— `kotoba/` と
`appview/` と `config/` は `ba3e3bd` 以降変わっていない。

tracked file は 26 本で、実体は 3 つに分かれている:

| 場所 | 中身 | この文書での扱い |
|---|---|---|
| `kotoba/` | public network-intelligence レジストリの TS 実装 + vitest スイート | step 2〜4 |
| `appview/etzhayyim-wasm-collector-c0ll3ct1/` | SvelteKit + Cloudflare Worker の edge facade | step 6 |
| `config/targets.json` | 収集対象（15 ドメイン / 10 IP / 6 レコード型） | step 5 |

---

## step 2 — 宣言されている `npm test` が走らないことを確認する

`kotoba/package.json` は `"test": "vitest run"` を宣言している。だが依存が入らない。

```bash
cd /tmp/collector-walk/kotoba
npm install --no-audit --no-fund 2>&1 | grep -o 'EALLOWSCRIPTS' | head -1
ls node_modules 2>/dev/null | wc -l | tr -d ' '
```

期待:

```
EALLOWSCRIPTS
0
```

理由: `@etzhayyim/sdk` は git 依存で `prepare: tsc` を持つ。npm はそれを用意する
ために内部で `npm install --allow-scripts` を呼ぶが、**npm 11 は project-scoped
install でそのフラグを拒否する**（`--allow-scripts is not allowed in project-scoped
installs`）。`--ignore-scripts` を足しても、`allow-scripts=true` を `.npmrc` に
置いても同じところで落ちる（両方実測済み）—— 拒否しているのは依存の側の
package.json を読む内側の npm なので、こちら側の設定では届かない。

**したがって committed の vitest スイートは、宣言された経路では一度も実行されて
いない。** 赤いのではなく沈黙している。

step 3 はこれを迂回して**実際に走らせる**。

---

## step 3 — スイートを実際に走らせる（この repo で唯一動く実行経路）

迂回できる理由は、依存の実態が package.json の見た目より遥かに薄いこと:

- `kotoba/test/collector.test.ts` が実行時に要るのは `@etzhayyim/sdk-mock` の
  `MockEtzhayyim` **1 つだけ**
- その `@etzhayyim/sdk-mock` は **import を 1 つも持たない 309 行の単一 TS ファイル**
  （`main` が `src/index.ts` そのもの。ビルド段が無い）
- `kotoba/src/registry.ts` の `@etzhayyim/sdk` 参照は `import type` なので
  **トランスパイル時に消える**（実行時には存在しなくてよい）

つまり必要なのは registry から入る `vitest` 1 本と、mock のソースへの alias だけ。

```bash
# 3-a. vitest だけを別ディレクトリに入れる（git 依存を一切通らない）
mkdir -p /tmp/collector-deps && cd /tmp/collector-deps
printf '{"name":"collector-walk","private":true,"type":"module","devDependencies":{"vitest":"^4.1.0"}}\n' > package.json
npm install --no-audit --no-fund 2>&1 | tail -1

# 3-b. mock を pin された commit で取る（package.json が指しているのと同じ commit）
git clone --quiet https://github.com/etzhayyim/com-etzhayyim-sdk-mock.git /tmp/collector-mock
git -C /tmp/collector-mock checkout --quiet c857ff9be5310bf433bfe1e8d3c0f677e213d667

# 3-c. alias 付きの walk 専用 config（repo の vitest.config.ts は触らない）
cd /tmp/collector-walk/kotoba
ln -sfn /tmp/collector-deps/node_modules node_modules
cat > vitest.walk.config.ts <<'EOF'
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "node", include: ["test/**/*.test.ts"] },
  resolve: { alias: { "@etzhayyim/sdk-mock": "/tmp/collector-mock/src/index.ts" } },
});
EOF

# 3-d. 走らせる
./node_modules/.bin/vitest run --config vitest.walk.config.ts
```

3-a は `added 44 packages in <n>s`。3-d の期待:

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

**4 本とも緑。** 4 本の内訳は run のライフサイクル / DNS 観測の FK / blockchain
actor + risk signal / coverage 集計。

⚠ `vitest.walk.config.ts` と `node_modules` symlink は**歩くために作った物**で、
commit しない。片付けは step 7。

---

## step 4 — そのスイートが本当に何かを見張っているかを確かめる

緑を見ただけでは、スイートが検査しているのか黙っているのか区別できない。
実装を 1 箇所ずつ壊して、**赤くなるか**を見る。

```bash
cd /tmp/collector-walk/kotoba
run(){ ./node_modules/.bin/vitest run --config vitest.walk.config.ts 2>&1 | grep -E '^ +(Test Files|Tests) '; }
mut(){ cp "$3" /tmp/m.orig; sed -i '' "$2" "$3"
  if diff -q /tmp/m.orig "$3" >/dev/null; then echo "!! 変異が当たっていない: $1"; else echo "--- $1"; run; fi
  cp /tmp/m.orig "$3"; }

mut "M1 run source を検証しない"          's|if (!SOURCES.has(input.source))|if (false)|'                                    src/registry.ts
mut "M2 DNS record type を検証しない"      's|if (!DNS_TYPES.has(input.recordType))|if (false)|'                              src/registry.ts
mut "M3 chain を検証しない"                's|if (!CHAINS.has(input.chain))|if (false)|'                                      src/registry.ts
mut "M4 running でない run を finish できる" 's|if (run.status !== "running")|if (false)|'                                     src/registry.ts
mut "M5 severity を検証しない"             's|if (!SEVERITIES.has(input.severity))|if (false)|'                               src/registry.ts
mut "M6 subjectType を検証しない"          's|if (!SUBJECT_TYPES.has(input.subjectType))|if (false)|'                         src/registry.ts
mut "M7 itemsCollected の非負整数検査を外す" 's|if (input.itemsCollected != null \&\& !isNonNegInt(input.itemsCollected))|if (false)|' src/registry.ts
```

実測（`mut` は変異が**当たったこと**を diff で確かめてから走らせる —— 当たらな
かった変異は緑のまま帰ってきて「スイートが検出できない」と読めてしまうため）:

| 変異 | 結果 | 意味 |
|---|---|---|
| M1 run source | **赤** 1 failed / 3 passed | 検査されている |
| M2 DNS record type | **赤** 1 failed / 3 passed | 検査されている |
| M3 chain | **赤** 1 failed / 3 passed | 検査されている |
| M4 finish non-running | **赤** 1 failed / 3 passed | 検査されている |
| M5 severity | **緑 4 passed** | **検査されていない** |
| M6 subjectType | **緑 4 passed** | **検査されていない** |
| M7 itemsCollected | **緑 4 passed** | **検査されていない** |

M5〜M7 が緑なのは偶然ではない。`test/collector.test.ts` は `recordSignal` に
`severity: "high" / "critical" / "medium"`、`subjectType: "address" / "domain" / "ip"`
という**妥当な値しか渡していない**し、`finishRun` に負の `itemsCollected` を
渡す行が無い。`registry.ts` はこの 3 つを実際に拒否するコードを持っているが、
**その拒否を一度も観測していない。**

これは「テストが足りない」という一般論ではなく、**次に足すテストが 3 本、名指しで
決まっている**という意味である（`invalidSeverity` / `invalidSubjectType` /
`itemsCollectedMustBeNonNegInt` の 3 つの reject パス）。

---

## step 5 — 収集対象が実在することを確かめる

`config/targets.json` は 15 ドメイン・10 IP・6 レコード型を挙げている。
実装がまだ何も収集していなくても、**対象そのものは今日引ける**。

```bash
cd /tmp/collector-walk
for d in icann.org iana.org nic.ad.jp; do printf '%-12s %s\n' "$d" "$(dig +short NS "$d" | sort | head -2 | tr '\n' ' ')"; done
curl -s -o /dev/null -w 'iana rdap bootstrap  -> %{http_code}\n' https://data.iana.org/rdap/dns.json
curl -s -o /dev/null -w 'rdap.org/domain      -> %{http_code}\n' -L https://rdap.org/domain/icann.org
curl -s -o /dev/null -w 'arin rdap ip 1.1.1.1 -> %{http_code}\n' -L https://rdap.arin.net/registry/ip/1.1.1.1
```

期待（NS の値は権威側が変えうるので、**2 本以上返ること**を見る）:

```
icann.org    a.icann-servers.net. b.icann-servers.net.
iana.org     a.iana-servers.net. b.iana-servers.net.
nic.ad.jp    ns3.nic.ad.jp. ns5.nic.ad.jp.
iana rdap bootstrap  -> 200
rdap.org/domain      -> 200
arin rdap ip 1.1.1.1 -> 200
```

`types.ts` の `CollectorSource` が挙げる 6 つの源のうち、**この step が到達性を
実証したのは `dns` と `rdap` の 2 つだけ**である。`blockchain` / `commonCrawl` /
`portScan` / `internetArchive` は型として在るだけで、この repo に endpoint も
資格情報も無い。

---

## step 6 — 配備されている面を確かめる（live ではない）

`appview/etzhayyim-wasm-collector-c0ll3ct1/wrangler.jsonc` は
`collector.etzhayyim.com/*` の route を宣言している。

```bash
dig +short collector.etzhayyim.com A | wc -l | tr -d ' '
dig +short etzhayyim.com A | wc -l | tr -d ' '
curl -s -o /dev/null -m 20 -w 'collector.etzhayyim.com -> %{http_code}\n' -L https://collector.etzhayyim.com/
```

期待:

```
0
2
collector.etzhayyim.com -> 000
```

**ホスト名に A レコードが無い**（親の `etzhayyim.com` は 2 本返るので、DNS 自体は
生きている）。`000` は HTTP の応答ではなく、curl が接続に到達しなかったことを表す。
**この appview は今日 live ではない。**

もう 1 つ、配備したときに効く既知の食い違いがある。この workspace の検出器が
名指ししている:

```bash
# superproject 側で
nbb --classpath ".:scripts/nbb_compat" scripts/verify-appview-facade.cljs | grep collector
```

→ `health-only-in-undeployed-facade:orgs/cloud-itonami/collector — appview/*/src/app.ts
serves /health and no route under svelte/src/ does, while wrangler main deploys
svelte/.svelte-kit/cloudflare/_worker.js`

読み下すと: `/health` と `/_app/meta` を持っているのは `src/app.ts` だが、
wrangler が `main` として配るのは SvelteKit のビルド成果物
（`svelte/.svelte-kit/cloudflare/_worker.js`）で、そちらの route は
`+page.svelte` と `xrpc/[...path]/+server.ts` の 2 本しかない。
**この service を `/health` で死活監視すると SvelteKit の 404 を叩く。**
読む人が開くファイル（`src/app.ts`）と、配られるファイルが別物である。

---

## step 7 — 片付ける

```bash
rm -f  /tmp/collector-walk/kotoba/vitest.walk.config.ts
rm -f  /tmp/collector-walk/kotoba/node_modules          # symlink を消すだけ
rm -rf /tmp/collector-walk /tmp/collector-deps /tmp/collector-mock
```

step 4 の `mut` は各変異のあとに必ず元へ戻すが、途中で中断した場合は
`git -C /tmp/collector-walk checkout -- kotoba/src/registry.ts` で戻せる
（そもそも `/tmp` の使い捨て clone なので、消せば済む）。

---

## この repo の現在地（step 1〜6 が実際に示したこと）

| 問い | 実測の答え |
|---|---|
| 宣言された `npm test` は走るか | **走らない**（npm 11 の `EALLOWSCRIPTS`, step 2） |
| スイートは走らせられるか | **走る**。vitest + mock ソースへの alias で 4/4 緑（step 3） |
| そのスイートは何かを見張っているか | **4 箇所は見張っている**（M1〜M4 が赤）。**3 箇所は見張っていない**（M5〜M7、step 4） |
| 収集対象は実在するか | **する**。DNS / RDAP は今日引ける（step 5） |
| 6 つの source のうち到達性を実証できたのは | **2 つ**（`dns` / `rdap`）。残り 4 つは型だけ |
| appview は live か | **live ではない**（A レコード無し, step 6） |
| 配備したら `/health` は答えるか | **答えない**（facade の食い違い, step 6） |

次に手を入れるなら、費用が最も小さくて効果が確実なのは step 4 が名指しした
**3 本の reject パスのテスト**（`invalidSeverity` / `invalidSubjectType` /
`itemsCollectedMustBeNonNegInt`）である。実装は既にあり、観測だけが無い。
