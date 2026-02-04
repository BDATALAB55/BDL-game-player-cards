/* scripts/run_game.cjs
 * 使い方: node scripts/run_game.cjs 505048
 */
const { fetchGameBoxscore } = require("./fetch_bleague_boxscore.cjs");
const { renderPlayers } = require("./render_players.cjs");     // 選手カード用
const { renderBReport } = require("./render_B_report.cjs");   // 359行の戦評レポート用

async function main() {
  const gameId = process.argv[2];
  if (!gameId) {
    console.error("Usage: node scripts/run_game.cjs <ScheduleKey>");
    process.exit(1);
  }

  console.log(`\n🚀 GameID: ${gameId} の全行程を開始します...`);

  // 1. データのスクレイピング
  console.log(`\n[1/3] スクレイピング中...`);
  await fetchGameBoxscore(gameId, { headless: true });

  // 2. 選手個別カードの生成
  console.log(`\n[2/3] 選手カード画像を生成中...`);
  await renderPlayers(gameId, { headless: true });

  // 3. 全体レポート（こだわり359行）の生成
  console.log(`\n[3/3] 戦評レポート画像を生成中...`);
  await renderBReport(gameId);

  console.log(`\n✨ すべての工程が正常に完了しました！`);
}

main().catch((e) => {
  console.error("❌ 致命的なエラーが発生しました:");
  console.error(e);
  process.exit(1);
});