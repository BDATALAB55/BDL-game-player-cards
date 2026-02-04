/* scripts/run_B_report.cjs */
const fs = require("fs"); 
const path = require("path");
// 【修正】読み込み先を .cjs に変更
const { fetchBReportData } = require("./fetch_B_report.cjs");
const { renderBReport } = require("./render_B_report.cjs");

async function main() {
    const gameId = process.argv[2];
    if (!gameId) {
        console.error("❌ 試合IDを指定してください。 例: node scripts/run_B_report.cjs 504734");
        process.exit(1);
    }

    try {
        console.log(`🚀 ゲームレポート生成開始 [ID: ${gameId}]`);
        
        // Step 1: データ取得
        await fetchBReportData(gameId);
        
        // 【修正】パスの基準を確実にプロジェクトルート (process.cwd) にする
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