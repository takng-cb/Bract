import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 開発用の一回限りスクリプト（DB マイグレ等）は生 SQL 行を扱うため any を許容（warning に降格）。
  {
    files: ["scripts/**/*.{ts,js}"],
    rules: { "@typescript-eslint/no-explicit-any": "warn" },
  },
  // `_` 始まりは「意図的に未使用」の慣習（CSV 取込の分割代入など）として無視する。
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // worktree のコピー（.claude/worktrees/<name>/...）とその .next ビルド成果物は
    // ソースではないので lint 対象から除外する（npm run lint の CI ゲートを安定させる）。
    ".claude/**",
    "**/.next/**",
    "**/build/**",
    "**/node_modules/**",
    // 生成された配布物（lint 対象のソースではない）
    "**/_out/**",
    // PWA が生成する Service Worker / workbox ランタイム
    "public/sw.js",
    "public/workbox-*.js",
    "public/fallback-*.js",
    // デザインハンドオフのモックアップ（HTML/JS、アプリのソースではない）
    "design_handoff/**",
  ]),
]);

export default eslintConfig;
