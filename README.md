# etzhayyim-project-collector

`etzhayyim-project-collector` は、IP アドレス / DNS / RDAP を中心に、グローバルなネットワーク情報を収集する App プロジェクトです。

## 目的

- 世界各地域のドメイン・IP を対象に DNS レコードを継続収集
- 収集対象に対する RDAP 情報を取得し、PII 寄りの項目を抑制した形で保持
- MCP ツールとして収集・照会・JSON-LD 出力を提供

## 重複整理方針

このプロジェクトでは、既存の類似 collector 実装を `60-apps/etzhayyim-project-collector/wasm/` へ集約します。

- 既存 project に散在していた collector の重複を解消
- 収集機能を collector project に統一
- 旧配置は削除し、collector project を一次管理点にする

## 主コンポーネント

- `wasm/network-intel-collector-component`
  - `collector.run`
  - `collector.status`
  - `collector.list_targets`
  - `collector.get_collected`
  - `collector.export_jsonld`
