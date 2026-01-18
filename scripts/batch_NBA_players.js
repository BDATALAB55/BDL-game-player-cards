/* scripts/batch_NBA_players.js
 * 使い方: node scripts/batch_NBA_players.js 0022500541 0022500542
 */
const fs = require('fs');
const path = require('path');
const { fetchNbaPlayerStats } = require("./fetch_nba_players");
const { renderNbaPlayerCards } = require("./render_NBA_players");

async function batchRun(ids) {
    if (ids.length === 0) {
        console.error("❌ エラー: ゲームIDを1つ以上指定してください。");
        return;
    }

    console.log(`\n📦 バッチ処理開始: 合計 ${ids.length} 試合のプレイヤーカードとアプリ用データを生成します`);
    console.log("==================================================");

    // アプリに表示する全選手データを蓄積する配列
    let allPlayersForApp = [];

    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        console.log(`\n[${i + 1}/${ids.length}] 🚀 処理中: Game ID ${id}`);

        try {
            // 1. データの取得
            const data = await fetchNbaPlayerStats(id);
            
            if (data && data.players && data.players.length > 0) {
                console.log(`✅ データ取得成功: ${data.players.length} 名の選手が見つかりました。`);
                
                // 2. カードのレンダリング（画像生成）
                await renderNbaPlayerCards(id, ""); 
                
                // 3. アプリ用データの整理
                // スクリーンショットのデータ構造に基づき、必要な項目を抽出
                data.players.forEach(p => {
                    allPlayersForApp.push({
                        id: `${id}_${p.personId}`, // ユニークなID
                        name: `${p.firstName} ${p.familyName}`,
                        team: data.teamName || "NBA", 
                        no: p.jerseyNum || "-",
                        pts: p.points || 0,
                        reb: p.reboundsTotal || 0,
                        ast: p.assists || 0,
                        gameId: id,
                        // 画像へのパス（Astroのpublicフォルダからの相対パスを想定）
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

    // --- ここでアプリ（Astro）側のフォルダにデータを保存 ---
    try {
        const appDataDir = path.join(__dirname, '../my-card-app/src/data');
        const appDataPath = path.join(appDataDir, 'players.json');

        // フォルダがなければ作成
        if (!fs.existsSync(appDataDir)) {
            fs.mkdirSync(appDataDir, { recursive: true });
        }

        // 得点順（PTS）にランキングを並び替えて保存
        allPlayersForApp.sort((a, b) => b.pts - a.pts);

        fs.writeFileSync(appDataPath, JSON.stringify(allPlayersForApp, null, 2));
        console.log("\n📱 [SUCCESS] my-card-app用の最新ランキングデータを更新しました！");
    } catch (e) {
        console.error("\n❌ アプリ用データの保存に失敗しました:", e.message);
    }

    console.log("\n==================================================");
    console.log("✨ すべてのバッチ処理が正常に終了しました。");
}

const gameIds = process.argv.slice(2);
batchRun(gameIds);