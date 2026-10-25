# セキュリティポリシー / Security Policy

## 脆弱性の報告

脆弱性を見つけた場合は、公開の Issue や Pull Request には書かないでください。
GitHub の [Private vulnerability reporting](https://github.com/jinxin4869/order_app/security/advisories/new) から非公開で報告してください。

報告には、次の情報を含めてください。

- 影響を受ける箇所（ファイル、関数名、URL など）
- 再現手順
- 想定される影響

受け付けた報告には、7 日以内に返信することを目標にしています。

## Reporting a vulnerability

Please do not open a public issue or pull request for security problems.
Report them privately through GitHub's [Private vulnerability reporting](https://github.com/jinxin4869/order_app/security/advisories/new), including the affected location, steps to reproduce, and the expected impact.
We aim to respond within 7 days.

## 対象 / Scope

- 対象は `main` ブランチの最新版です。/ Only the latest `main` branch is supported.
- 本番環境や第三者のサービス（Firebase、DeepL）への攻撃的なテストはしないでください。ローカルのエミュレーター（`npm run test:rules`）で検証してください。/ Do not run intrusive tests against the production Firebase project or third-party services; use the local emulators instead.
