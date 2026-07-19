# etzhayyim-project-collector App migration

このディレクトリは collector 系 wasm component の集約先です。

## 実装済み / 集約対象

- `network-intel-collector-component` (DNS/IP/RDAP 収集)
- `malak-blockchain-collector-component` (malak 由来の blockchain disclosure 収集/開示)
- 既存類似 collector component (他 project から移管)

## 方針

- collector 実装の重複を避け、collector project に一本化
- MCP インターフェースを維持しつつ収集ロジックを拡張
