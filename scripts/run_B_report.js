/* scripts/run_B_report.js
 * 使い方: node scripts/run_B_report.js 504734
 */
const fs = require("fs"); // これが抜けていたためにエラーが発生していました
const path = require("path");
const { fetchBReportData } = require("./fetch_B_report");
const { renderBReport } = require("./render_B_report");

async function main() {
    const gameId = process.argv[2];
    if (!gameId) {
        console.error("❌ 試合IDを指定してください。 例: node scripts/run_B_report.js 504734");
        process.exit(1);
    }

    try {
        console.log(`🚀 ゲームレポート生成開始 [ID: ${gameId}]`);
        
        // Step 1: データ取得
        await fetchBReportData(gameId);
        
        // JSONが作成されたか確認してからレンダリングへ
        const reportJsonPath = path.join(process.cwd(), "data", "reports", `report_${gameId}.json`);
        
        if (fs.existsSync(reportJsonPath)) {
            // Step 2: 画像生成
            await renderBReport(gameId);
            console.log(`✨ すべての工程が完了しました！`);
        } else {
            console.error("❌ データの取得に失敗したため、レンダリングを中止しました。");
        }
    } catch (e) {
        console.error(`❌ エラーが発生しました:`, e);
        process.exit(1);
    }
}

main();