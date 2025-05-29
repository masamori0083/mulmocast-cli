# MulmoCast CLI ドキュメント

## 概要
MulmoCast は、AI と人間が協調してマルチモーダルなプレゼンテーションを生成するための CLI ツールです。JSON 形式の **MulmoScript** を用いることで、テキスト・画像・音声などを組み合わせたコンテンツを作成できます。

## 主要ファイル・ディレクトリ
- **src/** – TypeScript のメイン実装。
  - **actions/** – `audio.ts`、`images.ts`、`movie.ts` など、各種生成処理を定義したモジュール。
  - **agents/** – OpenAI や Google など外部サービス用のエージェント。TTS や画像生成を担当。
  - **cli/** – `bin.ts` を入口とする CLI 実装。yargs を用いて各コマンドを定義。
  - **methods/** – MulmoScript や Studio データ操作のユーティリティ群。
  - **tools/** – URL からのスクリプト生成やプロンプト出力など補助ツール。
  - **types/** – 型定義および JSON スキーマを提供。
  - **utils/** – ffmpeg 連携、キャッシュ、プロンプト生成などのユーティリティ関数。
- **prompts/** – 各種 LLM 用プロンプトのテンプレート。
- **scripts/** – サンプルスクリプトやテンプレート類。
- **assets/** – フォント、効果音、HTML テンプレートなどの静的ファイル。
- **docs/** – リリースノートや開発資料。
- **test/** – Node.js の `node:test` を用いた単体テスト。

## 処理フロー
1. `mulmo tool scripting` で MulmoScript を生成。
2. `mulmo audio` でテキストを音声化し、BGM を追加。
3. `mulmo images` で画像を生成し、スクリプトに関連付け。
4. `mulmo movie` で音声・画像を組み合わせて動画を生成。
5. 必要に応じて `mulmo pdf` や `mulmo translate` などを実行。

このフローは `src/actions` 内の各モジュールで定義されており、`GraphAI` ライブラリを通じてエージェントを組み合わせて処理が行われます。全体のワークフロー図は `docs/Workflow.md` の mermaid 図にも示されています【F:docs/Workflow.md†L1-L27】。

## 依存パッケージ
主な依存パッケージは `package.json` に記載されています。以下は一部抜粋です【F:package.json†L35-L67】。
- `@graphai/*` 系パッケージ – LLM エージェントの実装
- `@google-cloud/text-to-speech` – Google TTS
- `fluent-ffmpeg` – ffmpeg 操作
- `puppeteer` – 画像生成や PDF 用レンダリング
- `pdf-lib` / `@pdf-lib/fontkit` – PDF 出力
- `yargs` / `inquirer` – CLI 実装
- `dotenv` – 環境変数読み込み
- `zod` / `zod-to-json-schema` – スキーマ定義

## 参考情報
プロジェクト全体の概要や Quick Start は README を参照してください。たとえば、MulmoCast の特徴を説明する部分は README の次の箇所です【F:README.md†L12-L29】。

