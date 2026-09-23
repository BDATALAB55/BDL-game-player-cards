const {
    fetchEuroleagueBoxscore,
} = require(
    "./fetch_euroleague_boxscore.cjs"
);

const {
    renderBReport,
} = require(
    "./render_B_report.cjs"
);

const {
    renderPlayers,
} = require(
    "./render_players.cjs"
);

function seasonLabelFromCode(
    seasonCode
) {
    const match =
        String(seasonCode || "")
            .toUpperCase()
            .match(/^E(\d{4})$/);

    if (!match) {
        throw new Error(
            "seasonCode must look like E2026"
        );
    }

    const startYear =
        Number(match[1]);

    const endYear =
        String(
            startYear + 1
        ).slice(-2);

    return (
        `${startYear}-${endYear}`
    );
}

async function run() {
    const seasonCode =
        String(
            process.argv[2] || ""
        )
            .trim()
            .toUpperCase();

    const gameCode =
        String(
            process.argv[3] || ""
        ).trim();

    if (
        !seasonCode ||
        !gameCode
    ) {
        throw new Error(
            "Usage: " +
            "node scripts/run_euroleague_game.cjs " +
            "E2026 1"
        );
    }

    const seasonLabel =
        seasonLabelFromCode(
            seasonCode
        );

    process.env.B_REPORT_SEASON =
        seasonLabel;

    process.env.B_REPORT_STAGE =
        "Regular Season";

    process.env.B_PLAYER_LEAGUE =
        "EUROLEAGUE";

    process.env.B_PLAYER_SEASON =
        seasonLabel;

    console.log(
        "========================================"
    );
    console.log(
        "EUROLEAGUE GAME PIPELINE"
    );
    console.log(
        `SEASON: ${seasonCode} (${seasonLabel})`
    );
    console.log(
        `GAMECODE: ${gameCode}`
    );
    console.log(
        "========================================"
    );

    console.log("");
    console.log(
        "[1/3] Fetch official boxscore"
    );

    const fetched =
        await fetchEuroleagueBoxscore(
            seasonCode,
            gameCode
        );

    const {
        reportId,
        result,
    } = fetched;

    console.log("");
    console.log(
        "[2/3] Render GAME REPORT"
    );

    await renderBReport(
        reportId
    );

    console.log("");
    console.log(
        "[3/3] Render GAME PLAYER cards"
    );

    await renderPlayers(
        reportId
    );

    console.log("");
    console.log(
        "========================================"
    );
    console.log(
        "EUROLEAGUE GAME PIPELINE: PASSED"
    );
    console.log(
        `${result.homeName} ` +
        `${result.scoreHome} - ` +
        `${result.scoreAway} ` +
        `${result.awayName}`
    );
    console.log(
        `PLAYERS: ${result.players.length}`
    );
    console.log(
        `REPORT ID: ${reportId}`
    );
    console.log(
        "========================================"
    );
}

run().catch(error => {
    console.error("");
    console.error(
        "EUROLEAGUE GAME PIPELINE: FAILED"
    );
    console.error(
        error.stack || error.message
    );

    process.exit(1);
});
