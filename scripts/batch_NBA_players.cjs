/* scripts/batch_NBA_players.cjs */
const fs = require('fs');
const path = require('path');
// 1. 読み込み先を .cjs に変更
const { fetchNbaPlayerStats } = require("./fetch_NBA_players.cjs");
const { renderNbaPlayerCards } = require("./render_NBA_players.cjs");

async function batchRun(ids) {
    if (ids.length === 0) {
        console.error("❌ エラー: ゲームIDを1つ以上指定してください。");
        return;
    }

    console.log(`\n📦 バッチ処理開始: 合計 ${ids.length} 試合のプレイヤーカードとアプリ用データを生成します`);
    console.log("==================================================");

    let allPlayersForApp = [];

    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        console.log(`\n[${i + 1}/${ids.length}] 🚀 処理中: Game ID ${id}`);

        try {
            const data = await fetchNbaPlayerStats(id);
            
            if (data && data.players && data.players.length > 0) {
                console.log(`✅ データ取得成功: ${data.players.length} 名の選手が見つかりました。`);
                
                await renderNbaPlayerCards(id, ""); 
                
                data.players.forEach(p => {
                    allPlayersForApp.push({
                        id: `${id}_${p.personId}`,
                        name: `${p.firstName} ${p.familyName}`,
                        team: data.teamName || "NBA", 
                        no: p.jerseyNum || "-",
                        pts: p.points || 0,
                        reb: p.reboundsTotal || 0,
                        ast: p.assists || 0,
                        gameId: id,
                        image: `/output/players/NBA_Cards_${id}_${p.personId}.png`
                    });
                });

                console.log(`✨ 完了: Game ID ${id} のすべてのカードを出力しました。`);
            } else {
                console.error(`⚠️ 警告: Game ID ${id} の選手データが見つかりませんでした。`);
            }
        } catch (error) {
            console.error(`❌ エラー発生 (Game ID ${id}):`, error.message);
        }
    }

    // --- 2. 保存先の修正 (フォルダ移動後の階層に合わせる) ---
    try {
        // my-card-appフォルダを消して中身を外に出したので、直下の src/data を見るように修正
        const appDataDir = path.join(process.cwd(), 'src/data');
        const appDataPath = path.join(appDataDir, 'players.json');

        if (!fs.existsSync(appDataDir)) {
            fs.mkdirSync(appDataDir, { recursive: true });
        }

        allPlayersForApp.sort((a, b) => b.pts - a.pts);

        fs.writeFileSync(appDataPath, JSON.stringify(allPlayersForApp, null, 2));
        console.log("\n📱 [SUCCESS] 最新ランキングデータ (src/data/players.json) を更新しました！");
    } catch (e) {
        console.error("\n❌ アプリ用データの保存に失敗しました:", e.message);
    }

    console.log("\n==================================================");
    console.log("✨ すべてのバッチ処理が正常に終了しました。");
}

const gameIds = process.argv.slice(2);
batchRun(gameIds);