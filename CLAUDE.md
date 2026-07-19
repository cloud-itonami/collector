# etzhayyim-project-collector

Unified collector App (`collector.etzhayyim.com`) — network intelligence, resource data, blockchain monitoring を 1 app に統合。

## Component

| Component | Folder | nanoid | Deploy |
|---|---|---|---|
| collector (unified) | `etzhayyim-wasm-collector-c0ll3ct1` | c0ll3ct1 | apps-mt manifest |

## App

- Runtime: Single Worker (TS Native + SvelteKit SSR)
- Deploy: `etzhayyim build && etzhayyim deploy --from .`

## XRPC API

3 service paths (互換 + Event Stream split):

| Service | Methods |
|---|---|
| `CollectorQueryService` | `GetDashboard`, `ListJobs`, `GetJob`, `ListWorkers` |
| `CollectorCommandService` | `TriggerRun`, `CollectNetintelDNS`, `CollectBlockchain`, `VerifyDisclosure`, `QueryRisk`, `IngestAbuseReport`, `IngestLeakEntity`, `AnalyzeEntity`, `GetEntityGraph` |
| `CollectorDashboardService` | 全メソッド (後方互換) |

## Storage (CRITICAL) — Kysely + RisingWave (SQL archived 2026-04-13)

DO SQLite 不使用。全データは Kysely → Hyperdrive → RisingWave PG :4566。

| 操作 | API | 経路 |
|---|---|---|
| **Write** | `sdk.pds.createRecord(collection, record)` | PDS → RisingWave (PDS commit pipeline) |
| **Read** | `createKyselyDb().selectFrom("vertex_*")` | Hyperdrive → RisingWave PG wire |
| **Read (join)** | `db.selectFrom("vertex_a").innerJoin(...)` | Kysely join (edge table) |
| **Notify** | `WSend(channel, kind, data, ...)` | W Protocol timeline |

### Direct SQL Route (auth bypass, CLI/agent 向け)

```bash
# RisingWave LoadBalancer (LKE, no auth)
psql "postgresql://root@172.236.132.11:4566/dev?sslmode=disable"

# INSERT (RDAP + DoH + GeoIP → vertex_dns_observation / vertex_ip_address)
INSERT INTO vertex_dns_observation (vertex_id, created_date, ...) VALUES (...);
INSERT INTO vertex_ip_address (vertex_id, created_date, ...) VALUES (...);
```

### Kysely パターン (app.ts)

```typescript
import { createKyselyDb } from "@etzhayyim/kotodama-host-sdk";

// Read — dashboard counts
const db = createKyselyDb();
const dns = await db.selectFrom("vertex_dns_observation")
  .select((eb) => eb.fn.countAll<string>().as("cnt"))
  .where("repo", "is not", null)
  .executeTakeFirst();

// Read — list jobs with filter
const jobs = await db.selectFrom("vertex_collector_run")
  .selectAll()
  .where("collector", "=", "netintel-dns")
  .orderBy("started_at", "desc")
  .limit(50)
  .execute();

// Write — via PDS (Design E Tier 2)
await sdk.pds.createRecord("com.etzhayyim.apps.collector.dnsObservation", record);
```

### Graph Model

| Node Label | PK property | 用途 |
|---|---|---|
| `CollectorRun` | `run_id` | 収集実行記録 |
| `CommodityValue` | `node_id = commodity:{id}:{region}:{year}` | 資源価格データ |
| `DnsObservation` | `node_id = dns:{domain}` | DNS/RDAP 結果 |
| `Organization` | `node_id = org:rdap-registrar-{handle}` | RDAP レジストラ |
| `Nameserver` | `node_id = dns:{hostname}` | ネームサーバ |
| `BlockchainActor` | `node_id = bchain:{actor_id}` | 監視対象 |
| `RiskSignal` | `node_id = risk:{id}` | リスクシグナル |
| `Disclosure` | `node_id = disclosure:{id}` | ブロックチェーン開示 |
| `IPAddress` | `node_id = ip:{addr}` | IP アドレス |
| `EmailAddress` | `node_id = email:{addr}` | メールアドレス |
| `PhoneNumber` | `node_id = phone:{number}` | 電話番号 |
| `FraudAccount` | `node_id = acct:{institution}:{number}` | 不正口座 |
| `LeakedCompany` | `node_id = leakco:{slug}` | 流出企業 |
| `AbuseReport` | `node_id = abuse:{id}` | 違反報告 |
| `ReportSource` | `node_id = source:{slug}` | 報告ソース |
| `DnsSnapshot` | `node_id = dns-snap:{domain}:{ts}` | DNS 観測スナップショット |
| `IPSnapshot` | `node_id = ip-snap:{ip}:{ts}` | IP 観測スナップショット |

全ノードに `org_id`, `user_id`, `actor_id` (RLS)。

### Edges

| Rel Type | From → To |
|---|---|
| `PRODUCED` | `CollectorRun` → `CommodityValue` |
| `OBSERVED` | `CollectorRun` → `DnsObservation` |
| `DETECTED` | `CollectorRun` → `RiskSignal` |
| `REGISTERED_WITH` | `DnsObservation` → `Organization` |
| `NAMESERVER` | `DnsObservation` → `Nameserver` |
| `EMITS` | `BlockchainActor` → `RiskSignal` |
| `HAS_DISCLOSURE` | `BlockchainActor` → `Disclosure` |
| `REPORTED_BY` | `AbuseReport` → `ReportSource` |
| `TARGETS` | `AbuseReport` → IP/Email/Phone/Account/DNS |
| `LEAKED_FROM` | Email/Account → `LeakedCompany` |
| `RESOLVES_TO` | `DnsObservation` → `IPAddress` (A record, edge_resolves_to table) |
| `RISK_FOR` | `RiskSignal` → any target entity |
| `SNAPSHOT` | `DnsObservation` → `DnsSnapshot`, `IPAddress` → `IPSnapshot` |
| `ALLOCATED_BY` | `IPAddress` → `Organization` |

## Graph Model (additional nodes)

| Node Label | ID Prefix | 用途 |
|---|---|---|
| `DnsChange` | `dns-change:{domain}:{type}:{ts}` | DNS 変更検知レコード (registrar/NS/A/MX/DNSSEC) |

## Collectors (all internal functions)

| ID | Category | Data Source | Status |
|---|---|---|---|
| `malak-btc` | blockchain | linode-crypto (Bitcoin Core v27.1 + Electrs) — `linode-crypto.etzhayyim.com` | BTC sync 45.6% 待ち |
| `malak-eth` | blockchain | linode-crypto (Erigon v2.61.3) — `linode-crypto.etzhayyim.com` | ETH snapshot 55% 待ち |
| `netintel-dns` | netintel | RDAP (TLD 別エンドポイント 25 TLD + IANA fallback) + Cloudflare DoH (A/AAAA/MX/NS/TXT/CNAME) | ✅ 稼働中 |
| `common-crawl` | passive-dns | Common Crawl CDX API (index.commoncrawl.org) | ✅ 稼働中 |
| `internet-archive` | passive-dns | Internet Archive CDX API (web.archive.org/cdx) | ✅ 稼働中 |
| `scan-ingest` | scan | CF Container / linode-intel scanner → POST ingestScanResult | ✅ 稼働中 |
| `abuse-report` | abuse | 違反報告 (IP/DNS/Email/Phone/Account) | ✅ 稼働中 |
| `leak-db` | leak | 流出 DB (Email/Phone/Account → LeakedCompany) | ✅ 稼働中 |

## intel-blockchain (LKE sg-sin-2 namespace)

Bitcoin Core + Electrs + Erigon は既存 LKE cluster (sg-sin-2) 内 `intel-blockchain` namespace で稼働。
URL: `https://linode-crypto.etzhayyim.com` (NodeBalancer `139.162.92.210`) — Auth: `X-Auth-Token` header

| Pod | Image | PVC | Sync Status |
|---|---|---|---|
| `bitcoin-core-0` | `lncm/bitcoind:v27.1` + `mempool/electrs:latest` | 900 Gi | height=685929, 45.6% (2026-04-12) |
| `erigon-0` | `erigontech/erigon:v2.61.3` | 700 Gi | snapshot 55% (peers=0 停止中) |
| `geoip-service` | python:3.12-alpine | — | ✅ 稼働 (`linode-geoip.etzhayyim.com`) |

Secrets 登録済み (worker secrets 2026-04-12):
- `SS_LINODE_CRYPTO_TOKEN` / `SS_LINODE_CRYPTO_URL` = `https://linode-crypto.etzhayyim.com`
- `SS_LINODE_GEOIP_TOKEN` / `SS_LINODE_GEOIP_URL` = `https://linode-geoip.etzhayyim.com`

## Entity DID Registration

収集時に path-based DID を自動登録:
| Entity | DID |
|---|---|
| BTC address | `did:web:c0ll3ct1.etzhayyim.com:btc:{address}` |
| ETH address | `did:web:c0ll3ct1.etzhayyim.com:eth:{address}` |
| DNS domain | `did:web:c0ll3ct1.etzhayyim.com:dns:{domain}` |
| IP address | `did:web:c0ll3ct1.etzhayyim.com:ip:{ip}` |

## DNS Change Detection

`collectNetintelDns` 実行時に前回の `DnsSnapshot` と比較し、変更があれば `DnsChange` record を書込み:
- 検知項目: registrar 変更 / NS レコード変更 / A レコード変更 / MX レコード変更 / DNSSEC 変更

## Build & Deploy

```bash
cd 60-apps/etzhayyim-project-collector/wasm/etzhayyim-wasm-collector-c0ll3ct1
etzhayyim deploy   # etzhayyim build は不要 (TS Native)
```

## Smoke Test

```bash
# DNS (RDAP + DoH)
curl -s -X POST https://c0ll3ct1.etzhayyim.com/xrpc/com.etzhayyim.apps.collector.collectNetintelDns \
  -H "Content-Type: application/json" -H "Authorization: Bearer $(etzhayyim authn token)" \
  -d '{"domain":"cloudflare.com"}' | jq '{domain,registrar,dnssec,a:.records.a}'

# BTC (sync 完了後に real data)
curl -s -X POST https://c0ll3ct1.etzhayyim.com/xrpc/com.etzhayyim.apps.collector.collectBlockchainBtc \
  -H "Content-Type: application/json" -H "Authorization: Bearer $(etzhayyim authn token)" \
  -d '{"address":"1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf"}' | jq .

# Dashboard
curl -s -X POST https://c0ll3ct1.etzhayyim.com/xrpc/com.etzhayyim.apps.collector.getDashboard \
  -H "Authorization: Bearer $(etzhayyim authn token)" | jq .
```
