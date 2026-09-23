const fs = require("fs");
const https = require("https");
const path = require("path");
const { spawnSync } = require("child_process");

const APP_ROOT =
    "/Volumes/HD-CD-1/Masaki/B/BDATALAB APP";

const REPORT_DATA_DIR =
    path.join(
        APP_ROOT,
        "data",
        "reports"
    );

const GAME_REPORT_ROOT =
    path.join(
        APP_ROOT,
        "output",
        "Game Reports",
        "EUROLEAGUE"
    );

const GAME_PLAYER_ROOT =
    path.join(
        APP_ROOT,
        "output",
        "Game Players",
        "EUROLEAGUE"
    );

function getJson(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(
            url,
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
                        "AppleWebKit/537.36 Chrome/152 Safari/537.36",
                    Accept:
                        "application/json, text/plain, */*",
                    Referer:
                        "https://www.euroleaguebasketball.net/",
                },
            },
            response => {
                if (
                    response.statusCode >= 300 &&
                    response.statusCode < 400 &&
                    response.headers.location
                ) {
                    response.resume();

                    const redirectUrl =
                        new URL(
                            response.headers.location,
                            url
                        ).toString();

                    getJson(redirectUrl)
                        .then(resolve)
                        .catch(reject);

                    return;
                }

                let body = "";

                response.setEncoding("utf8");

                response.on(
                    "data",
                    chunk => {
                        body += chunk;
                    }
                );

                response.on(
                    "end",
                    () => {
                        if (
                            response.statusCode !== 200
                        ) {
                            reject(
                                new Error(
                                    `HTTP ${response.statusCode}: ` +
                                    body.slice(0, 500)
                                )
                            );

                            return;
                        }

                        try {
                            resolve(
                                JSON.parse(body)
                            );
                        } catch (error) {
                            reject(
                                new Error(
                                    "JSON parse error: " +
                                    error.message
                                )
                            );
                        }
                    }
                );
            }
        );

        req.setTimeout(
            60000,
            () => {
                req.destroy(
                    new Error(
                        "Request timeout"
                    )
                );
            }
        );

        req.on(
            "error",
            reject
        );
    });
}

function seasonLabelFromCode(
    seasonCode
) {
    const match =
        String(
            seasonCode || ""
        )
            .toUpperCase()
            .match(/^E(\d{4})$/);

    if (!match) {
        throw new Error(
            "seasonCode must look like E2026"
        );
    }

    const startYear =
        Number(match[1]);

    return (
        `${startYear}-` +
        String(
            startYear + 1
        ).slice(-2)
    );
}

function isPlayed(game) {
    return (
        game.played === true ||
        String(
            game.played
        ).toLowerCase() === "true"
    );
}

function getClubCode(side) {
    return String(
        side?.club?.code ||
        side?.code ||
        side?.clubCode ||
        ""
    )
        .trim()
        .toUpperCase();
}

function getGameDate(game) {
    for (
        const value
        of [
            game.date,
            game.localDate,
            game.confirmedDate,
            game.utcDate,
        ]
    ) {
        const match =
            String(
                value || ""
            ).match(
                /\d{4}-\d{2}-\d{2}/
            );

        if (match) {
            return match[0];
        }
    }

    return "DATE_UNKNOWN";
}

function walkFiles(root) {
    if (!fs.existsSync(root)) {
        return [];
    }

    const output = [];
    const stack = [root];

    while (stack.length > 0) {
        const current =
            stack.pop();

        for (
            const entry
            of fs.readdirSync(
                current,
                {
                    withFileTypes: true,
                }
            )
        ) {
            const fullPath =
                path.join(
                    current,
                    entry.name
                );

            if (entry.isDirectory()) {
                stack.push(fullPath);
            } else {
                output.push(fullPath);
            }
        }
    }

    return output;
}

function walkDirectories(root) {
    if (!fs.existsSync(root)) {
        return [];
    }

    const output = [];
    const stack = [root];

    while (stack.length > 0) {
        const current =
            stack.pop();

        for (
            const entry
            of fs.readdirSync(
                current,
                {
                    withFileTypes: true,
                }
            )
        ) {
            if (!entry.isDirectory()) {
                continue;
            }

            const fullPath =
                path.join(
                    current,
                    entry.name
                );

            output.push(fullPath);
            stack.push(fullPath);
        }
    }

    return output;
}

function buildOutputIndex(
    seasonLabel
) {
    const reportRoot =
        path.join(
            GAME_REPORT_ROOT,
            seasonLabel,
            "Regular Season"
        );

    const playerRoot =
        path.join(
            GAME_PLAYER_ROOT,
            seasonLabel
        );

    return {
        reportFiles:
            walkFiles(reportRoot)
                .filter(
                    file =>
                        file
                            .toLowerCase()
                            .endsWith(
                                ".png"
                            )
                ),
        playerDirs:
            walkDirectories(
                playerRoot
            ),
    };
}

function inspectGame(
    seasonCode,
    gameCode,
    outputIndex
) {
    const reportId =
        `euroleague_${seasonCode}_${gameCode}`;

    const reportJson =
        path.join(
            REPORT_DATA_DIR,
            `report_${reportId}.json`
        );

    let expectedPlayers = 0;

    if (
        fs.existsSync(
            reportJson
        )
    ) {
        try {
            const data =
                JSON.parse(
                    fs.readFileSync(
                        reportJson,
                        "utf8"
                    )
                );

            expectedPlayers =
                Array.isArray(
                    data.players
                )
                    ? data.players.length
                    : 0;
        } catch {
            expectedPlayers = 0;
        }
    }

    const reportImage =
        outputIndex.reportFiles.find(
            file =>
                path.basename(
                    file
                ).includes(
                    `_${reportId}_`
                )
        ) || null;

    const matchingPlayerDirs =
        outputIndex.playerDirs.filter(
            dir =>
                path.basename(
                    dir
                ).startsWith(
                    `game_${reportId}_`
                )
        );

    let maxPlayerImages = 0;
    let bestPlayerDir = null;

    for (
        const dir
        of matchingPlayerDirs
    ) {
        const count =
            fs.readdirSync(
                dir,
                {
                    withFileTypes: true,
                }
            )
                .filter(
                    entry =>
                        entry.isFile() &&
                        entry.name
                            .toLowerCase()
                            .endsWith(
                                ".png"
                            )
                )
                .length;

        if (
            count >
            maxPlayerImages
        ) {
            maxPlayerImages =
                count;
            bestPlayerDir =
                dir;
        }
    }

    const complete =
        fs.existsSync(
            reportJson
        ) &&
        Boolean(
            reportImage
        ) &&
        expectedPlayers > 0 &&
        maxPlayerImages >=
            expectedPlayers;

    return {
        reportId,
        reportJson,
        reportImage,
        expectedPlayers,
        playerImages:
            maxPlayerImages,
        playerDir:
            bestPlayerDir,
        complete,
    };
}

async function main() {
    const args =
        process.argv.slice(2);

    const seasonCode =
        String(
            args.find(
                arg =>
                    /^E\d{4}$/i.test(
                        arg
                    )
            ) || "E2026"
        ).toUpperCase();

    const doRun =
        args.includes(
            "--run"
        );

    const gameArg =
        args.find(
            arg =>
                arg.startsWith(
                    "--game="
                )
        );

    const targetGameCode =
        gameArg
            ? Number(
                gameArg.split(
                    "="
                )[1]
            )
            : null;

    const seasonLabel =
        seasonLabelFromCode(
            seasonCode
        );

    const url =
        "https://api-live.euroleague.net/" +
        "v2/competitions/E/seasons/" +
        `${seasonCode}/games?limit=500`;

    console.log(
        "========================================"
    );
    console.log(
        "EUROLEAGUE DAILY RUNNER"
    );
    console.log(
        `SEASON: ${seasonCode} (${seasonLabel})`
    );
    console.log(
        `MODE: ${doRun ? "RUN" : "DRY RUN"}`
    );

    if (
        targetGameCode !== null
    ) {
        console.log(
            `GAME FILTER: ${targetGameCode}`
        );
    }

    console.log(
        "========================================"
    );

    const schedule =
        await getJson(url);

    let games =
        (schedule.data || [])
            .filter(
                isPlayed
            );

    if (
        targetGameCode !== null
    ) {
        games =
            games.filter(
                game =>
                    Number(
                        game.gameCode
                    ) ===
                    targetGameCode
            );
    }

    games.sort(
        (a, b) =>
            Number(a.gameCode) -
            Number(b.gameCode)
    );

    let outputIndex =
        buildOutputIndex(
            seasonLabel
        );

    const pending = [];

    console.log("");
    console.log(
        "===== PLAYED GAME AUDIT ====="
    );

    for (
        const game
        of games
    ) {
        const gameCode =
            Number(
                game.gameCode
            );

        const audit =
            inspectGame(
                seasonCode,
                gameCode,
                outputIndex
            );

        const home =
            getClubCode(
                game.local
            );

        const away =
            getClubCode(
                game.road
            );

        const status =
            audit.complete
                ? "COMPLETE"
                : "PENDING";

        console.log(
            `${String(gameCode).padStart(3, "0")} ` +
            `${getGameDate(game)} ` +
            `${home}-${away} ` +
            `${status} ` +
            `[report=${audit.reportImage ? "Y" : "N"} ` +
            `players=${audit.playerImages}/${audit.expectedPlayers}]`
        );

        if (
            !audit.complete
        ) {
            pending.push(
                game
            );
        }
    }

    console.log("");
    console.log(
        "===== SUMMARY ====="
    );
    console.log(
        "PLAYED:",
        games.length
    );
    console.log(
        "COMPLETE:",
        games.length -
            pending.length
    );
    console.log(
        "PENDING:",
        pending.length
    );

    if (!doRun) {
        console.log("");
        console.log(
            "DRY RUN ONLY: no cards were generated"
        );
        return;
    }

    if (
        pending.length === 0
    ) {
        console.log("");
        console.log(
            "NOTHING TO PROCESS"
        );
        return;
    }

    console.log("");
    console.log(
        "===== PROCESS PENDING GAMES ====="
    );

    for (
        const game
        of pending
    ) {
        const gameCode =
            Number(
                game.gameCode
            );

        console.log("");
        console.log(
            `>>> ${seasonCode} GAME ${gameCode}`
        );

        const result =
            spawnSync(
                process.execPath,
                [
                    path.join(
                        __dirname,
                        "run_euroleague_game.cjs"
                    ),
                    seasonCode,
                    String(
                        gameCode
                    ),
                ],
                {
                    stdio:
                        "inherit",
                    env:
                        process.env,
                }
            );

        if (
            result.status !== 0
        ) {
            throw new Error(
                `Game ${gameCode} pipeline failed`
            );
        }

        outputIndex =
            buildOutputIndex(
                seasonLabel
            );

        const after =
            inspectGame(
                seasonCode,
                gameCode,
                outputIndex
            );

        if (
            !after.complete
        ) {
            throw new Error(
                `Game ${gameCode} did not pass completion audit`
            );
        }

        console.log(
            `✅ GAME ${gameCode} COMPLETE`
        );
    }

    console.log("");
    console.log(
        "EUROLEAGUE DAILY RUNNER: PASSED"
    );
}

main().catch(
    error => {
        console.error("");
        console.error(
            "EUROLEAGUE DAILY RUNNER: FAILED"
        );
        console.error(
            error.stack ||
            error.message
        );
        process.exit(1);
    }
);
