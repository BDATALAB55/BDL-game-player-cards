/* scripts/batch_render_only.cjs */
const fs = require("fs");
const path = require("path");
// 読み込む関数を renderPlayers（選手カード用）に固定
const { renderPlayers } = require("./render_players.cjs");

async function run() {
    // 引数からGameIDのリストを取得
    const ids = process.argv.slice(2);

    if (ids.length === 0) {
        console.log("⚠️ GameIDをスペース区切りで入力してください。 例: node scripts/batch_render_only.cjs 505209 505210");
        return;
    }

    console.log(`🚀 合計 ${ids.length} 試合の「既存JSON ➔ 選手スタッツ生成」プロセスを開始します...`);

    for (const id of ids) {
        console.log(`\n-----------------------------------------`);
        console.log(`🔷 RENDERING: GameID ${id}`);
        
        // JSONファイルの存在確認（パスは環境に合わせて調整してください）
        const reportJsonPath = path.join(process.cwd(), "data", "reports", `report_${id}.json`);

        if (fs.existsSync(reportJsonPath)) {
            try {
                // 画像生成のみ実行
                await renderPlayers(id);
                console.log(`✅ GameID ${id} の画像再生成が完了しました！`);
            } catch (err) {
                console.error(`❌ GameID ${id} のレンダリング中にエラー発生:`, err.message);
            }
        } else {
            console.warn(`⚠️ スキップ: JSONファイルが見つかりません (${reportJsonPath})`);
            console.log(`   先に fetch を行うか、ファイル名を確認してください。`);
        }
    }

    console.log("\n✨ 指定された全試合のレンダリング処理が終了しました！");
}

run();