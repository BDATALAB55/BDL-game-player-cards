const fs = require("fs");
const https = require("https");
const path = require("path");

const REPORT_DIR =
    "/Volumes/HD-CD-1/Masaki/B/BDATALAB APP/data/reports";

const TEAM_NAMES = {
    ASV: "ASVEL",
    BAR: "BARCELONA",
    BAS: "BASKONIA",
    BES: "BESIKTAS",
    DUB: "DUBAI",
    HTA: "HAPOEL TEL AVIV",
    IST: "ANADOLU EFES",
    MAD: "REAL MADRID",
    MIL: "MILAN",
    MUN: "BAYERN",
    OLY: "OLYMPIACOS",
    PAM: "VALENCIA",
    PAN: "PANATHINAIKOS",
    PAR: "PARTIZAN",
    PRS: "PARIS",
    RED: "CRVENA ZVEZDA",
    TEL: "MACCABI TEL AVIV",
    ULK: "FENERBAHCE",
    VIR: "BOLOGNA",
    ZAL: "ZALGIRIS KAUNAS",
};

function getJson(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(
            url,
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
                        "AppleWebKit/537.36 Chrome/152 Safari/537.36",
                    Accept: "application/json, text/plain, */*",
                    Referer: "https://www.euroleaguebasketball.net/",
                },
            },
            response => {
                if (
                    response.statusCode >= 300 &&
                    response.statusCode < 400 &&
                    response.headers.location
                ) {
                    response.resume();

                    const redirectUrl = new URL(
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
                        if (response.statusCode !== 200) {
                            reject(
                                new Error(
                                    `HTTP ${response.statusCode}: ` +
                                    body.slice(0, 500)
                                )
                            );
                            return;
                        }

                        try {
                            resolve(JSON.parse(body));
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
                    new Error("Request timeout")
                );
            }
        );

        req.on("error", reject);
    });
}

function text(value) {
    return value == null
        ? ""
        : String(value).trim();
}

function num(value) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
        ? parsed
        : 0;
}

function pct(made, attempted) {
    const a = num(attempted);

    if (a <= 0) {
        return "0";
    }

    return (
        (num(made) / a) *
        100
    ).toFixed(1);
}

function ratio(value, total) {
    const t = num(total);

    if (t <= 0) {
        return "0";
    }

    return String(
        Math.round(
            (num(value) / t) *
            100
        )
    );
}

function normalizePlayerName(raw) {
    const value = text(raw);

    if (!value) {
        return "";
    }

    const commaIndex = value.indexOf(",");

    if (commaIndex === -1) {
        return value
            .replace(/\s+/g, " ")
            .toUpperCase();
    }

    const family = value
        .slice(0, commaIndex)
        .trim();

    const given = value
        .slice(commaIndex + 1)
        .trim();

    return `${given} ${family}`
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
}

function normalizeDate(game) {
    const candidates = [
        game.date,
        game.localDate,
        game.confirmedDate,
        game.utcDate,
    ];

    for (const candidate of candidates) {
        const value = text(candidate);

        const match = value.match(
            /(\d{4})-(\d{2})-(\d{2})/
        );

        if (match) {
            return (
                `${match[1]}.` +
                `${match[2]}.` +
                `${match[3]}`
            );
        }
    }

    throw new Error(
        "Game date could not be determined"
    );
}

function getClubCode(side) {
    return text(
        side?.club?.code ||
        side?.code ||
        side?.clubCode
    ).toUpperCase();
}

function getStatsCode(side) {
    const teamRow = side?.tmr?.Team;

    if (text(teamRow)) {
        return text(teamRow).toUpperCase();
    }

    const players =
        side?.PlayersStats || [];

    const firstWithCode =
        players.find(
            player => text(player.Team)
        );

    return text(
        firstWithCode?.Team
    ).toUpperCase();
}

function teamDisplayName(code) {
    const name = TEAM_NAMES[code];

    if (!name) {
        throw new Error(
            `Unknown EuroLeague club code: ${code}`
        );
    }

    return name;
}

function normalizePlayer(
    raw,
    teamName
) {
    const f2m =
        num(raw.FieldGoalsMade2);

    const f2a =
        num(raw.FieldGoalsAttempted2);

    const f3m =
        num(raw.FieldGoalsMade3);

    const f3a =
        num(raw.FieldGoalsAttempted3);

    const ftm =
        num(raw.FreeThrowsMade);

    const fta =
        num(raw.FreeThrowsAttempted);

    const points =
        num(raw.Points);

    const fieldGoalAttempts =
        f2a + f3a;

    const normalizedName =
        normalizePlayerName(
            raw.Player
        );

    return {
        teamNameRaw: teamName,
        no:
            text(raw.Dorsal) || "-",
        isStarter:
            Boolean(
                Number(
                    raw.IsStarter
                )
            ),
        nameJp: normalizedName,
        detailUrl: "",
        externalPlayerId:
            text(raw.Player_ID),
        min:
            text(raw.Minutes) ||
            "00:00",
        pts:
            String(points),
        fg2Str:
            `${f2m}/${f2a}`,
        fg2Pct:
            pct(f2m, f2a),
        fg3Str:
            `${f3m}/${f3a}`,
        fg3Pct:
            pct(f3m, f3a),
        ftStr:
            `${ftm}/${fta}`,
        ftPct:
            pct(ftm, fta),
        ptsRatio2P:
            ratio(
                f2m * 2,
                points
            ),
        ptsRatio3P:
            ratio(
                f3m * 3,
                points
            ),
        ptsRatioFT:
            ratio(
                ftm,
                points
            ),
        attRatio2P:
            ratio(
                f2a,
                fieldGoalAttempts
            ),
        attRatio3P:
            ratio(
                f3a,
                fieldGoalAttempts
            ),
        reb:
            String(
                num(
                    raw.TotalRebounds
                )
            ),
        oreb:
            String(
                num(
                    raw.OffensiveRebounds
                )
            ),
        dreb:
            String(
                num(
                    raw.DefensiveRebounds
                )
            ),
        ast:
            String(
                num(raw.Assistances)
            ),
        stl:
            String(
                num(raw.Steals)
            ),
        blk:
            String(
                num(
                    raw.BlocksFavour
                )
            ),
        to:
            String(
                num(raw.Turnovers)
            ),
        pf:
            String(
                num(
                    raw.FoulsCommited
                )
            ),
        plusMinus:
            raw.Plusminus == null
                ? ""
                : String(
                    num(
                        raw.Plusminus
                    )
                ),
        name: normalizedName,
    };
}

function normalizeTeamTotal(raw) {
    if (!raw) {
        throw new Error(
            "Missing official team total (totr)"
        );
    }

    return {
        pts:
            num(raw.Points),
        f2m:
            num(
                raw.FieldGoalsMade2
            ),
        f2a:
            num(
                raw.FieldGoalsAttempted2
            ),
        f3m:
            num(
                raw.FieldGoalsMade3
            ),
        f3a:
            num(
                raw.FieldGoalsAttempted3
            ),
        ftm:
            num(
                raw.FreeThrowsMade
            ),
        fta:
            num(
                raw.FreeThrowsAttempted
            ),
        oreb:
            num(
                raw.OffensiveRebounds
            ),
        dreb:
            num(
                raw.DefensiveRebounds
            ),
        reb:
            num(
                raw.TotalRebounds
            ),
        ast:
            num(
                raw.Assistances
            ),
        tov:
            num(
                raw.Turnovers
            ),
        stl:
            num(
                raw.Steals
            ),
        blk:
            num(
                raw.BlocksFavour
            ),
        pf:
            num(
                raw.FoulsCommited
            ),
    };
}

function extractQuarterData(
    boxscore,
    statsByCode
) {
    const result = {};

    for (
        const [code, side]
        of statsByCode.entries()
    ) {
        const rawName =
            text(side.Team);

        const row =
            (boxscore.ByQuarter || [])
                .find(
                    item =>
                        text(item.Team) ===
                        rawName
                );

        if (!row) {
            result[code] = {};
            continue;
        }

        const quarters = {};

        for (
            const [key, value]
            of Object.entries(row)
        ) {
            if (key === "Team") {
                continue;
            }

            quarters[key] =
                num(value);
        }

        result[code] =
            quarters;
    }

    return result;
}

async function fetchEuroleagueBoxscore(
    seasonCode,
    gameCode
) {
    const normalizedSeason =
        text(seasonCode)
            .toUpperCase();

    const normalizedGameCode =
        Number(gameCode);

    if (
        !/^E\d{4}$/.test(
            normalizedSeason
        )
    ) {
        throw new Error(
            "seasonCode must look like E2026"
        );
    }

    if (
        !Number.isInteger(
            normalizedGameCode
        )
    ) {
        throw new Error(
            "gameCode must be an integer"
        );
    }

    const scheduleUrl =
        "https://api-live.euroleague.net/" +
        "v2/competitions/E/seasons/" +
        `${normalizedSeason}/games?limit=500`;

    const boxscoreUrl =
        "https://live.euroleague.net/api/Boxscore" +
        `?gamecode=${normalizedGameCode}` +
        `&seasoncode=${normalizedSeason}`;

    const [
        schedule,
        boxscore,
    ] = await Promise.all([
        getJson(scheduleUrl),
        getJson(boxscoreUrl),
    ]);

    const games =
        schedule.data || [];

    const game =
        games.find(
            row =>
                Number(row.gameCode) ===
                normalizedGameCode
        );

    if (!game) {
        throw new Error(
            `Game ${normalizedGameCode} not found ` +
            `in ${normalizedSeason}`
        );
    }

    if (
        game.played !== true &&
        String(game.played) !== "true"
    ) {
        throw new Error(
            `Game ${normalizedGameCode} is not marked played`
        );
    }

    const homeCode =
        getClubCode(game.local);

    const awayCode =
        getClubCode(game.road);

    if (
        !homeCode ||
        !awayCode
    ) {
        throw new Error(
            "Schedule team codes missing"
        );
    }

    const homeName =
        teamDisplayName(homeCode);

    const awayName =
        teamDisplayName(awayCode);

    const statsRows =
        boxscore.Stats || [];

    if (statsRows.length !== 2) {
        throw new Error(
            `Expected 2 Stats rows, got ${statsRows.length}`
        );
    }

    const statsByCode =
        new Map();

    for (const side of statsRows) {
        const code =
            getStatsCode(side);

        if (!code) {
            throw new Error(
                "Could not identify Stats team code"
            );
        }

        statsByCode.set(
            code,
            side
        );
    }

    const homeStats =
        statsByCode.get(homeCode);

    const awayStats =
        statsByCode.get(awayCode);

    if (
        !homeStats ||
        !awayStats
    ) {
        throw new Error(
            "Schedule / Boxscore team code mismatch: " +
            `home=${homeCode}, away=${awayCode}, ` +
            `stats=${[
                ...statsByCode.keys()
            ].join(",")}`
        );
    }

    const players = [];

    for (
        const [code, side]
        of [
            [homeCode, homeStats],
            [awayCode, awayStats],
        ]
    ) {
        const teamName =
            teamDisplayName(code);

        for (
            const rawPlayer
            of side.PlayersStats || []
        ) {
            const playerId =
                text(
                    rawPlayer.Player_ID
                );

            const playerName =
                text(
                    rawPlayer.Player
                );

            if (
                !playerId &&
                !playerName
            ) {
                continue;
            }

            players.push(
                normalizePlayer(
                    rawPlayer,
                    teamName
                )
            );
        }
    }

    const homePlayers =
        players.filter(
            player =>
                player.teamNameRaw ===
                homeName
        );

    const awayPlayers =
        players.filter(
            player =>
                player.teamNameRaw ===
                awayName
        );

    const homeTotal =
        normalizeTeamTotal(
            homeStats.totr
        );

    const awayTotal =
        normalizeTeamTotal(
            awayStats.totr
        );

    const quarterData =
        extractQuarterData(
            boxscore,
            statsByCode
        );

    const venue =
        text(
            game.venue?.name ||
            game.venue?.venueName ||
            game.venueName
        );

    if (!venue) {
        throw new Error(
            "Venue missing from schedule"
        );
    }

    const round =
        text(
            game.roundName ||
            game.roundAlias
        ) ||
        (
            game.round != null
                ? `ROUND ${game.round}`
                : ""
        );

    const reportId =
        `euroleague_${normalizedSeason}_${normalizedGameCode}`;

    const result = {
        source:
            "euroleague",
        sourceSeasonCode:
            normalizedSeason,
        sourceGameCode:
            String(
                normalizedGameCode
            ),
        sourceGameId:
            text(game.id),
        homeCode,
        awayCode,
        homeName,
        awayName,
        scoreHome:
            String(
                homeTotal.pts
            ),
        scoreAway:
            String(
                awayTotal.pts
            ),
        date:
            normalizeDate(game),
        venue,
        venueRaw:
            venue,
        attendance:
            text(
                boxscore.Attendance
            ),
        leagueType:
            "EUROLEAGUE",
        round,
        home: {
            total:
                homeTotal,
            starters:
                homePlayers.filter(
                    player =>
                        player.isStarter
                ),
            quarters:
                quarterData[
                    homeCode
                ] || {},
        },
        away: {
            total:
                awayTotal,
            starters:
                awayPlayers.filter(
                    player =>
                        player.isStarter
                ),
            quarters:
                quarterData[
                    awayCode
                ] || {},
        },
        players,
        rawByQuarter:
            boxscore.ByQuarter || [],
        rawEndOfQuarter:
            boxscore.EndOfQuarter || [],
    };

    fs.mkdirSync(
        REPORT_DIR,
        {
            recursive: true,
        }
    );

    const reportPath =
        path.join(
            REPORT_DIR,
            `report_${reportId}.json`
        );

    fs.writeFileSync(
        reportPath,
        JSON.stringify(
            result,
            null,
            2
        ) + "\n",
        "utf8"
    );

    console.log(
        "-----------------------------------------"
    );
    console.log(
        `✅ EuroLeague取得成功: ` +
        `${homeName} ${result.scoreHome} - ` +
        `${result.scoreAway} ${awayName}`
    );
    console.log(
        `✅ ${reportPath}`
    );
    console.log(
        "-----------------------------------------"
    );

    return {
        reportId,
        reportPath,
        result,
    };
}

module.exports = {
    fetchEuroleagueBoxscore,
};

if (require.main === module) {
    const seasonCode =
        process.argv[2];

    const gameCode =
        process.argv[3];

    fetchEuroleagueBoxscore(
        seasonCode,
        gameCode
    ).catch(error => {
        console.error(
            "❌ EuroLeague取得エラー:",
            error.message
        );
        process.exitCode = 1;
    });
}
