export default function AboutPage() {
  return (
    <div className="p-4 md:p-8 max-w-3xl">
      {/* ヒーロー */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-zinc-900 tracking-tight mb-3">Bract</h1>
        <p className="text-lg text-zinc-500 leading-relaxed">
          営業活動という花を咲かせるために、<br />
          縁の下で支え続けるシステム。
        </p>
      </div>

      {/* コンセプト */}
      <section className="mb-12">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-6">Concept</h2>
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 mb-6">
          <p className="text-sm text-zinc-500 mb-3">知っていましたか？</p>
          <p className="text-zinc-800 leading-relaxed mb-4">
            ポインセチアの赤い「花びら」に見える部分、あれは花ではありません。
            本当の花は中心にある小さな黄色い部分。赤い部分はすべて
            <strong className="text-zinc-900">「Bract（苞）」</strong>
            という、葉が変化した構造体です。
          </p>
          <p className="text-zinc-800 leading-relaxed">
            Bractは花そのものではない。けれど、花を引き立て、外の世界に向けて押し出し、
            ときに花よりも輝く存在になる。
          </p>
        </div>
        <p className="text-zinc-600 leading-relaxed">
          このCRMも同じです。受注・商談・顧客との関係——それが「花」。
          Bractはその花を咲かせるために必要な情報を整理し、
          チームの営業活動を前面に押し出す、縁の下の力持ちです。
          目立たないけれど、なくてはならない存在を目指しています。
        </p>
      </section>

      {/* 機能紹介 */}
      <section className="mb-12">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-6">Features</h2>
        <div className="space-y-4">
          {[
            {
              icon: '🏢',
              title: '取引先',
              href: '/accounts',
              desc: '顧客企業の基本情報・業種・売上規模を管理します。ステータスバーで有効／無効を一目で把握できます。',
            },
            {
              icon: '👤',
              title: '人物',
              href: '/contacts',
              desc: '各企業の窓口となる人物を管理します。役職・部署・誕生日など、関係を深めるための情報を記録できます。',
            },
            {
              icon: '💼',
              title: '商談',
              href: '/opportunities',
              desc: '見込みから受注まで、商談のステージをビジュアルで管理します。金額・確度・完了予定日を追跡できます。',
            },
            {
              icon: '📋',
              title: '活動履歴',
              href: '/activities',
              desc: '電話・メール・打合せ・メモを時系列で記録します。顧客とのやり取りを振り返るための台帳です。',
            },
            {
              icon: '✅',
              title: 'ToDo',
              href: '/tasks',
              desc: 'フォローアップや社内タスクを管理します。優先度・期限・関連する取引先や商談を紐付けられます。',
            },
          ].map((f) => (
            <div key={f.title} className="flex gap-4 p-4 bg-white border border-zinc-200 rounded-lg hover:border-zinc-300 transition-colors">
              <span className="text-2xl shrink-0 mt-0.5">{f.icon}</span>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-1">{f.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 使い方ガイド */}
      <section className="mb-12">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-6">使い方ガイド</h2>
        <div className="space-y-8">

          <div>
            <h3 className="text-sm font-semibold text-zinc-800 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0">1</span>
              まず取引先を登録する
            </h3>
            <p className="text-sm text-zinc-500 leading-relaxed pl-7">
              「取引先」から顧客企業を追加します。会社名・業種・電話番号・Webサイトなどを入力してください。
              取引先はすべての情報の起点になります。
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-800 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0">2</span>
              人物を紐付ける
            </h3>
            <p className="text-sm text-zinc-500 leading-relaxed pl-7">
              取引先の詳細ページから「人物を追加」します。窓口となる人物の名前・役職・メールアドレスを登録しておくと、
              やり取りの記録がしやすくなります。
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-800 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0">3</span>
              商談を作成してステージを進める
            </h3>
            <p className="text-sm text-zinc-500 leading-relaxed pl-7">
              商談ごとにレコードを作成し、ステージバー（見込み → 要件確認 → 提案 → 交渉 → 受注）を
              クリックするだけでステータスを更新できます。
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-800 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0">4</span>
              活動を記録してToDoで次のアクションを管理する
            </h3>
            <p className="text-sm text-zinc-500 leading-relaxed pl-7">
              打合せや電話のたびに「活動履歴」を残しましょう。次のフォローアップは「ToDo」に登録して
              期限を設定しておくと、やり忘れを防げます。
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-800 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0">5</span>
              添付ファイルで情報を集約する
            </h3>
            <p className="text-sm text-zinc-500 leading-relaxed pl-7">
              提案書・契約書・議事録などのファイルを各レコードに直接添付できます。
              関連するすべての情報を一か所にまとめることで、担当者が変わっても引き継ぎがスムーズになります。
            </p>
          </div>

        </div>
      </section>

      {/* フッター */}
      <div className="border-t border-zinc-200 pt-6 text-xs text-zinc-400">
        Bract — Built for those who make relationships bloom.
      </div>
    </div>
  )
}
