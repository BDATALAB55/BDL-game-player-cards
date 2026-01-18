const fs = require("fs");
const path = require("path");
const { fetchGameBoxscore } = require("./fetch_bleague_boxscore.js"); // スクレイピング用
const { renderPlayers } = require("./render_players.js");           // 画像生成用

async function run() {
    // 引数からGameIDのリストを取得
    const ids = process.argv.slice(2);

    if (ids.length === 0) {
        console.log("⚠️ GameIDをスペース区切りで入力してください");
        return;
    }

    console.log(`🚀 合計 ${ids.length} 試合の「取得 ➔ 生成」フルプロセスを開始します...`);

    for (const id of ids) {
        console.log(`\n=========================================`);
        console.log(`🔷 START: GameID ${id}`);
        console.log(`=========================================`);

        try {
            // STEP 1: データの取り込み（JSON保存）
            console.log(`[Step 1/2] データをスクレイピング中...`);
            await fetchGameBoxscore(id);

            // STEP 2: カード作成（画像生成）
            console.log(`[Step 2/2] カード画像を生成中...`);
            await renderPlayers(id);

            console.log(`✅ GameID ${id} すべての工程が完了しました！`);

        } catch (err) {
            console.error(`❌ GameID ${id} の処理中にエラー発生:`, err.message);
        }
    }

    console.log("\n✨ 全試合の全行程が終了しました！お疲れ様でした！");
}

run();