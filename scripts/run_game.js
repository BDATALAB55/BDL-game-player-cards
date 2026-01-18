/* scripts/run_game.js
 * 使い方: node scripts/run_game.js 505048
 * DEBUG_TABLES=1 DEBUG_RENDER=1 もOK
 */
const { fetchGameBoxscore } = require("./fetch_bleague_boxscore");
const { renderPlayers } = require("./render_players");

async function main() {
  const gameId = process.argv[2];
  if (!gameId) {
    console.error("Usage: node scripts/run_game.js <ScheduleKey>");
    process.exit(1);
  }

  await fetchGameBoxscore(gameId, { headless: true });
  await renderPlayers(gameId, { headless: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
