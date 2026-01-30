// Expo設定ファイル - 環境変数を含む動的設定
export default ({ config }) => {
  return {
    ...config,
    plugins: [
      [
        "@sentry/react-native",
        {
          organization: process.env.SENTRY_ORG || "your-org-slug",
          project: process.env.SENTRY_PROJECT || "your-project-slug",
        },
      ],
    ],
    extra: {
      // Sentry DSNは環境変数から読み込む
      // 本番環境では .env ファイルまたは CI/CD で設定
      sentryDsn: process.env.SENTRY_DSN || null,
      // Firebase設定（必要に応じて追加）
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    },
  };
};
