/* scripts/run_nba_players.js */
const { fetchNbaPlayerStats } = require("./fetch_nba_players");
const { renderNbaPlayerCards } = require("./render_NBA_players");

async function main() {
  const gameId = process.argv[2];
  
  // 【修正1】3番目以降の引数を結合して roundText を取得
  const roundText = process.argv.slice(3).join(" ");

  if (!gameId) {
    console.error("❌ エラー: GameIDが指定されていません。");
    process.exit(1);
  }

  try {
    console.log(`\n🏀 NBA Player Cards Generation Start (GameID: ${gameId})`);
    
    // 【修正2】roundTextがあればログに表示（確認用）
    if (roundText) {
      console.log(`🏆 Round Info: ${roundText}`);
    }
    
    console.log("--------------------------------------------------");

    console.log("⏳ [Step 1/2] Fetching player stats from NBA API...");
    const statsData = await fetchNbaPlayerStats(gameId);
    
    if (!statsData || !statsData.players || statsData.players.length === 0) {
      throw new Error("スタッツデータの取得に失敗したか、選手データが空です。");
    }
    console.log(`✅ Success: ${statsData.players.length} 名の選手データを取得しました。`);

    console.log("⏳ [Step 2/2] Rendering player cards...");
    
    // 【修正3】第2引数として roundText を render 関数に渡す
    await renderNbaPlayerCards(gameId, roundText);

    console.log("--------------------------------------------------");
    console.log(`✨ すべての工程が完了しました！`);

  } catch (error) {
    console.error("\n❌ 実行中にエラーが発生しました:");
    console.error(error.message);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});