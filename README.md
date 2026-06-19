# system-name-calculator-ts

No Man's Sky の名前生成・座標変換・リバース検索を行う TypeScript ライブラリです。

C# 版 [SystemNameCalculator](https://github.com/andraemon/SystemNameCalculator) を TypeScript に移植し、Python 版 [nms_namegen](https://github.com/stuart/nms_namegen) の挙動を正として仕様差異を修正しています。

## Features

| 機能 | 説明 |
|------|------|
| Portal Code → Galactic Coordinates | ポータルコードから銀河座標への変換 |
| Galactic Coordinates → Portal Code | 銀河座標からポータルコードへの復元 |
| System Name 生成 | システム名の生成（ハイフン付き・ローマ数字サフィックス対応） |
| Region Name 生成 | リージョン名の生成（装飾語付き対応） |
| Planet Name 生成 | プラネット名の生成（11 スタイル対応） |
| Reverse Search | 名前から座標を検索（非推奨・実験的） |

## Usage

### Portal Code から情報を取得

```typescript
import {
  systemName,
  regionName,
  planetSeeds,
  planetName,
  portalToGalacticCoords,
  isValidPortal,
} from "system-name-calculator-ts";

const portal = BigInt("0x202101D40677");
const galaxy = 0;

// ポータルコードの妥当性チェック
console.log(isValidPortal(portal)); // true

// 銀河座標
const coords = portalToGalacticCoords(portal);
console.log(coords); // { x: 1655, y: 1, z: -704 }

// システム名・リージョン名
console.log(systemName(portal, galaxy));   // "Loytkara"
console.log(regionName(portal, galaxy));    // "Drlenj Expanse"

// プラネット
const ps = planetSeeds(portal, galaxy);
console.log(ps.planet_count); // 5
for (const seed of ps.planet_seeds) {
  console.log(planetName(seed));
}
// "Nock O23", "Hasenden VII", "Cogge", "Vassis Major", "Ibata 17/T1", "Sissica"
```

### Reverse Search（実験的・非推奨）

> **注意:** Reverse Search は実験的機能です。生成アルゴリズムの完全な逆変換ではなく、brute-force 探索による推定結果を返します。**返される Portal Code がゲーム上で有効・到達可能な座標とは限らない**ため、本番用途での使用は推奨しません。

| 項目 | 内容 |
|------|------|
| 仕様 | 名前から候補座標を探索する機能 |
| 制限 | Portal Code の有効性・到達可能性を保証しません |
| 将来性 | アルゴリズム変更の影響を受ける可能性があります |

**推奨用途:**
- 調査・研究目的
- デバッグ・テスト
- 候補の探索

**非推奨用途:**
- 実在する惑星の確定
- Portal Code の検証
- ナビゲーション用途

```typescript
import { findSystemSeeds, formatSystemName, reconstructPortal } from "system-name-calculator-ts";

// Warning: Reverse Search results are not guaranteed to be valid Portal Codes.
// Validate results before use. This feature is experimental and may be removed
// or changed in future versions.
const results = findSystemSeeds("Loytkara", {
  galaxy: 0,
  maxResults: 5,
  galCoordsStart: 0x00000000,
  galCoordsEnd: 0xFFFFFFFF,
});

for (const r of results) {
  const galCoords = (r.seed[0]! | (r.seed[1]! << 8) | (r.seed[2]! << 16) | (r.seed[3]! << 24)) >>> 0;
  const sysId = r.seed[5]! | (r.seed[6]! << 8);
  const portal = reconstructPortal(galCoords, sysId, 0);

  console.log(formatSystemName(r.seed));          // "Loytkara"
  console.log("0x" + portal.toString(16).toUpperCase().padStart(12, "0"));
  console.log(r.signalBoosterCoords);              // "081F:007F:07FF:00C6"
}
```

### CLI サンプル

```bash
# Portal Code から情報を取得
npx tsx examples/portal-lookup.ts 202101D40677 0

# Reverse Search
# WARNING: Reverse Search is experimental. Results may include invalid or unreachable Portal Codes.
npx tsx examples/reverse-search.ts "Loytkara" 0 --start 00000000 --end FFFFFFFF

# JSON 出力
npx tsx examples/portal-lookup.ts 202101D40677 0 --json
```

## Compatibility

- Python 版 [nms_namegen](https://github.com/stuart/nms_namegen) の挙動を参考にし、生成アルゴリズムの互換性を目標としています
- C# 版 [SystemNameCalculator](https://github.com/andraemon/SystemNameCalculator) からの移植過程で見つかった仕様差異を修正しています（例: ハイフン付きシステム名、ローマ数字サフィックス、Murmur ハッシュの符号拡張）
- Reverse Search など一部機能は独自実装です（nms_namegen に該当機能なし）。**実験的機能であり、結果の正確性・有効性は保証されません。**
- 157 テストすべてパス（Python 検証ベクトルとの一致確認済み）

## Credits / References

### [nms_namegen](https://github.com/stuart/nms_namegen)

- **License:** MIT
- 名前生成ロジック（`generateName`、アルファセット、装飾語）の参考元
- Python 実装の検証ベクトルを TypeScript 版のテストとして利用

### [SystemNameCalculator](https://github.com/andraemon/SystemNameCalculator)

- Portal Code / Galactic Coordinates 関連ロジックや仕様理解の参考元
- **ライセンス表記が確認できません。** 本プロジェクトでは参考元コードをそのままコピーしておらず、TypeScript での独自再実装ですが、仕様理解に利用したため記載します。利用範囲については各プロジェクトの規約をご確認ください

### [NMS_translate](https://github.com/monkeyman192/NMS_translate)

- **License:** MIT
- SystemNameCalculator が利用している関連プロジェクトとして記載

## License

本プロジェクトは [MIT License](LICENSE) でライセンスされています。

### 依存・参考プロジェクトのライセンス

| プロジェクト | ライセンス | 備考 |
|-------------|-----------|------|
| [nms_namegen](https://github.com/stuart/nms_namegen) | MIT | 名前生成ロジックの参考元 |
| [SystemNameCalculator](https://github.com/andraemon/SystemNameCalculator) | 確認不可 | 仕様理解の参考元 |
| [NMS_translate](https://github.com/monkeyman192/NMS_translate) | MIT | 関連プロジェクト |

**注意:** 本プロジェクトは参考元コードのコピーやフォークではなく、TypeScript での独自再実装です。各プロジェクトの著作権表示を尊重し、生成アルゴリズムの検証には Python 版 nms_namegen の検証ベクトルを使用しています。

## Development

### セットアップ

```bash
git clone <repository-url>
cd system-name-calculator-ts
pnpm install
```

### テスト

```bash
pnpm test
```

### ビルド

```bash
pnpm build
```

### CLI サンプルの実行

```bash
pnpm portal -- 202101D40677 0
pnpm reverse -- Loytkara 0 --start 00000000 --end FFFFFFFF
```
