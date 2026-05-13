# list ページ hydration 不全（Issue #20 系）の暫定対応

## 症状

- `/contacts` `/accounts` `/opportunities` などの **`loading.tsx` を持つ list ページ** で:
  - Suspense skeleton (`animate-pulse`) が表示されたまま消えない
  - アクションボタン（インポート / 新規作成 / エクスポート）が非表示
  - 一覧テーブルが表示されない
- DevTools で確認すると `<div id="S:0" hidden>` に本コンテンツが SSR されている

## 暫定 workaround（顧客側で打ってもらう）

DevTools コンソールで以下を貼り付け：

```js
const t = document.getElementById('B:0'); const s = document.getElementById('S:0');
if (t && s) {
  while (s.firstChild) t.parentNode.insertBefore(s.firstChild, t);
  t.remove(); s.remove();
  document.querySelector('.p-4.md\\:p-8.animate-pulse')?.remove();
}
```

これで該当タブのみ表示が復元される（ページ遷移時に再発）。

## 切り分け

1. **影響範囲** — 該当ページが 1 つだけか、全 list ページか
   - 1 つだけ → そのページ固有の問題（loading.tsx の構造 / page.tsx の async 処理）
   - 全 list ページ → 共通の hydration 不全
2. **ブラウザ要因の切り分け**
   - シークレットモードで再現するか
   - 別ブラウザ（Edge / Firefox）で再現するか
3. **Service Worker キャッシュ**
   ```js
   navigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister()));
   caches.keys().then(k => k.forEach(key => caches.delete(key)));
   location.reload();
   ```
4. **JS chunk のハッシュ確認**
   - DevTools の Network タブで `_next/static/chunks/webpack-*.js` のハッシュを記録
   - 別の deploy（数日前の commit）と比較してハッシュが変わっていない → Vercel deploy 未反映
   - ハッシュが変わっているのに症状が継続 → コード起因

## 想定原因

(2026-05-13 時点で調査中)

- ❌ Service Worker キャッシュ起因 → unregister しても改善せず棄却
- ❌ Vitest 追加が原因 → revert しても改善せず棄却
- ❓ Next.js 16 / React 19 の streaming SSR バグ
- ❓ next-pwa との相互作用
- ❓ Supabase Auth が SSR 中に待機して streaming complete を阻害

→ Issue #20 で調査継続中

## 恒久対策の候補

- next-pwa の disable オプションを試す（PWA を一旦切る）
- Suspense boundary を明示的に書いて挙動を制御
- loading.tsx を削除（skeleton 諦め）

## 関連 Issue

- #20 list ページの Suspense skeleton 外れず、アクションボタン非表示
- #18 Playwright E2E でこのクラスのバグを継続検出
- #25 Vercel deploy 失敗通知（このバグは deploy 成功扱いだが UX 破壊）
