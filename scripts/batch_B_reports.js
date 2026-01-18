const { spawn } = require('child_process');

// 実行時の引数（試合ID）を取得
const gameIds = process.argv.slice(2);

if (gameIds.length === 0) {
    console.log("❌ 試合IDを1つ以上指定してください。");
    console.log("例: node scripts/batch_B_reports.js 505698 505694 505690");
    process.exit(1);
}

async function runBatch() {
    console.log(`===========================================`);
    console.log(`🚀 B-REPORT 一括生成開始 (合計: ${gameIds.length} 試合)`);
    console.log(`===========================================\n`);

    for (let i = 0; i < gameIds.length; i++) {
        const id = gameIds[i];
        const progress = `[${i + 1}/${gameIds.length}]`;

        await new Promise((resolve) => {
            console.log(`${progress} 処理中 ID: ${id} ...`);
            
            // 既存の run_B_report.js を子プロセスとして実行
            // stdio: 'inherit' にすることで、実行中のログをそのまま表示します
            const child = spawn('node', ['scripts/run_B_report.js', id], { stdio: 'inherit' });

            child.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ 成功: ${id}\n`);
                } else {
                    console.log(`⚠️ 失敗: ${id} (終了コード: ${code})\n`);
                }
                resolve();
            });
        });
    }

    console.log(`===========================================`);
    console.log(`✨ すべての処理が完了しました！`);
    console.log(`出力先: output/reports/`);
    console.log(`===========================================`);
}

runBatch();