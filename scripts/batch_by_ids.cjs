/* scripts/batch_by_ids.cjs */
const fs = require("fs");
const path = require("path");
// 読み込む関数を renderPlayers（選手カード用）に固定
const { fetchGameBoxscore } = require("./fetch_bleague_boxscore.cjs"); 
const { renderPlayers } = require("./render_players.cjs");           

async function run() {
    // 引数からGameIDのリストを取得
    const ids = process.argv.slice(2);

    if (ids.length === 0) {
        console.log("⚠️ GameIDをスペース区切りで入力してください");
        return;
    }

    console.log(`🚀 合計 ${ids.length} 試合の「取得 ➔ 選手スタッツ生成」プロセスを開始します...`);

    for (const id of ids) {
        console.log(`\n=========================================`);
        console.log(`🔷 START: GameID ${id}`);
        console.log(`=========================================`);

        try {
            // STEP 1: データの取り込み（JSON保存）
            console.log(`[Step 1/2] データをスクレイピング中...`);
            await fetchGameBoxscore(id);

            // STEP 2: 今まで通りの選手スタッツ（カード画像）を作成
            console.log(`[Step 2/2] 選手スタッツ画像を生成中...`);
            await renderPlayers(id);

            console.log(`✅ GameID ${id} の選手スタッツ生成が完了しました！`);

        } catch (err) {
            console.error(`❌ GameID ${id} の処理中にエラー発生:`, err.message);
        }
    }

    console.log("\n✨ 全試合の処理が終了しました！お疲れ様でした！");
}

run();