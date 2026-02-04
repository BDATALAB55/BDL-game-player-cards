const { fetchNbaReportData } = require("./fetch_NBA_report.cjs");
const { renderNbaReport } = require("./render_NBA_report.cjs");

async function run(id, roundText) {
    if (!id) {
        console.error("❌ エラー: ゲームIDを指定してください。\n例: node run_NBA_report.js 0022500502");
        return;
    }

    try {
        console.log(`🚀 処理開始: Game ID ${id}`);
        
        // 追加のテキストがあれば表示
        if (roundText) {
            console.log(`🏆 Round Info: ${roundText}`);
        }
        
        // 1. データの取得
        const data = await fetchNbaReportData(id);
        
        // 2. データの取得に成功した場合のみレンダリング
        if (data) {
            // 第2引数として roundText を renderNbaReport に渡す
            await renderNbaReport(id, roundText);
            console.log("✨ すべての工程が正常に完了しました！");
        } else {
            console.error("❌ データの取得に失敗したため、レンダリングを中止しました。");
        }
    } catch (error) {
        console.error("❌ 実行中に予期せぬエラーが発生しました:", error);
    }
}

// ---------------------------------------------------------
// 引数の処理
// ---------------------------------------------------------
const gameId = process.argv[2];

// 3番目（index 3）以降の引数をすべて結合して、一つの文字列にする
// 例: node run.js 001 WEST FINALS G1 -> "WEST FINALS G1"
const roundText = process.argv.slice(3).join(" ");

// IDと結合したテキストを渡して実行
run(gameId, roundText);