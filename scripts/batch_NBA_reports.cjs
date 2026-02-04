const { fetchNbaReportData } = require("./fetch_NBA_report.cjs");
const { renderNbaReport } = require("./render_NBA_report.cjs");

async function batchRun(ids) {
    if (ids.length === 0) {
        console.error("❌ エラー: ゲームIDを1つ以上指定してください。");
        console.log("使用例: node scripts/batch_NBA_reports.cjs 0022500697 0022500698");
        return;
    }

    console.log(`開始: ${ids.length} 件のレポートを生成します...`);

    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        console.log(`\n[${i + 1}/${ids.length}] 🚀 処理中: Game ID ${id}`);

        try {
            // 1. データの取得
            // fetchNbaReportData 内部で process.cwd() を使用して data/reports へ保存されます
            const data = await fetchNbaReportData(id);
            
            if (data) {
                // 2. レンダリング
                // renderNbaReport 内部でも .cjs 対応が必要な場合があります
                await renderNbaReport(id, ""); 
                console.log(`✅ 完了: ${id}`);
            } else {
                console.error(`❌ データ取得失敗: ${id}`);
            }
        } catch (error) {
            console.error(`❌ エラー発生 (${id}):`, error.message);
        }
    }

    console.log("\n✨ すべてのバッチ処理が終了しました。");
}

// process.argv[2] 以降のすべての引数を ID 配列として取得
const gameIds = process.argv.slice(2);
batchRun(gameIds);