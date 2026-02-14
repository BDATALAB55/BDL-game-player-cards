/* scripts/render_only.cjs */
const fs = require("fs");
const path = require("path");
const { renderBReport } = require("./render_B_report.cjs");

async function main() {
    const gameId = process.argv[2];
    if (!gameId) {
        console.error("❌ 試合IDを指定してください。 例: node scripts/render_only.cjs 505209");
        process.exit(1);
    }

    try {
        console.log(`🎨 画像生成のみ実行中... [ID: ${gameId}]`);
        
        // JSONファイルの存在確認
        const reportJsonPath = path.join(process.cwd(), "data", "reports", `report_${gameId}.json`);
        
        if (fs.existsSync(reportJsonPath)) {
            // Step: 画像生成のみ実行
            await renderBReport(gameId);
            console.log(`✨ 画像の再生成が完了しました！`);
        } else {
            console.error(`❌ 指定されたIDのJSONファイルが見つかりません: ${reportJsonPath}`);
            console.error("先に node scripts/fetch_B_report.cjs でデータを取得してください。");
        }
    } catch (e) {
        console.error(`❌ レンダリング中にエラーが発生しました:`, e);
        process.exit(1);
    }
}

main();