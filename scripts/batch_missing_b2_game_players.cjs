const fs = require("fs");
const path = require("path");

const {
    fetchGameBoxscore,
} = require("./fetch_bleague_boxscore.cjs");

const {
    renderPlayers,
} = require("./render_players.cjs");

const DEFAULT_CSV =
    "/Users/masaki/bdatalab-web/tmp/" +
    "b2_2025_26_missing_game_player_games.csv";

const OUTPUT_ROOT =
    "/Volumes/HD-CD-1/Masaki/B/BDATALAB APP/" +
    "output/Game Players/B2/2025-26";

const LOG_ROOT = path.join(
    __dirname,
    "..",
    "tmp"
);

function parseCsvLine(line) {
    const values = [];
    let value = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];

        if (character === '"') {
            if (
                inQuotes &&
                line[index + 1] === '"'
            ) {
                value += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }

            continue;
        }

        if (character === "," && !inQuotes) {
            values.push(value);
            value = "";
            continue;
        }

        value += character;
    }

    values.push(value);

    return values;
}

function readCsv(csvPath) {
    const lines = fs
        .readFileSync(csvPath, "utf8")
        .split(/\r?\n/)
        .filter(line => line.trim() !== "");

    if (lines.length < 2) {
        return [];
    }

    const headers = parseCsvLine(lines[0]);

    return lines.slice(1).map(line => {
        const values = parseCsvLine(line);

        return Object.fromEntries(
            headers.map((header, index) => [
                header,
                values[index] || "",
            ])
        );
    });
}

function getOption(name) {
    const index = process.argv.indexOf(name);

    if (index === -1) {
        return null;
    }

    return process.argv[index + 1] || null;
}

function findGeneratedFolder(row) {
    const dateDirectory = path.join(
        OUTPUT_ROOT,
        row.date_folder
    );

    if (!fs.existsSync(dateDirectory)) {
        return null;
    }

    const prefix = `game_${row.game_id}_`;

    const candidates = fs
        .readdirSync(
            dateDirectory,
            {
                withFileTypes: true,
            }
        )
        .filter(entry =>
            entry.isDirectory() &&
            entry.name.startsWith(prefix)
        );

    for (const candidate of candidates) {
        const folder = path.join(
            dateDirectory,
            candidate.name
        );

        const pngCount = fs
            .readdirSync(folder)
            .filter(name =>
                name.toLowerCase().endsWith(".png")
            )
            .length;

        if (pngCount > 0) {
            return {
                folder,
                pngCount,
            };
        }
    }

    return null;
}

async function run() {
    const csvPath =
        getOption("--csv") ||
        DEFAULT_CSV;

    const limitValue =
        getOption("--limit");

    const limit = limitValue
        ? Number(limitValue)
        : null;

    const force =
        process.argv.includes("--force");

    if (!fs.existsSync(csvPath)) {
        throw new Error(
            `不足ゲームCSVが見つかりません: ${csvPath}`
        );
    }

    if (
        limitValue &&
        (
            !Number.isInteger(limit) ||
            limit <= 0
        )
    ) {
        throw new Error(
            "--limitには1以上の整数を指定してください"
        );
    }

    fs.mkdirSync(
        LOG_ROOT,
        {
            recursive: true,
        }
    );

    const rows = readCsv(csvPath);

    const pendingRows = [];
    const skippedRows = [];

    for (const row of rows) {
        const generated =
            findGeneratedFolder(row);

        if (generated && !force) {
            skippedRows.push({
                ...row,
                ...generated,
            });
        } else {
            pendingRows.push(row);
        }
    }

    const targetRows = limit
        ? pendingRows.slice(0, limit)
        : pendingRows;

    console.log(
        "===== B2 Game Players一括生成 ====="
    );
    console.log(`CSV内ゲーム数: ${rows.length}`);
    console.log(
        `生成済みスキップ: ${skippedRows.length}`
    );
    console.log(
        `今回の処理対象: ${targetRows.length}`
    );
    console.log(
        `未処理残数: ${
            pendingRows.length - targetRows.length
        }`
    );
    console.log();

    const completed = [];
    const failed = [];

    for (
        let index = 0;
        index < targetRows.length;
        index += 1
    ) {
        const row = targetRows[index];

        console.log(
            "========================================="
        );
        console.log(
            `[${index + 1}/${targetRows.length}] ` +
            `${row.game_date} | ${row.game_id}`
        );
        console.log(
            `${row.home_team_name} vs ` +
            `${row.away_team_name}`
        );
        console.log(
            "========================================="
        );

        try {
            await fetchGameBoxscore(
                row.game_id
            );

            await renderPlayers(
                row.game_id
            );

            const generated =
                findGeneratedFolder(row);

            if (!generated) {
                throw new Error(
                    "PNG生成後のフォルダを確認できません"
                );
            }

            completed.push({
                ...row,
                ...generated,
            });

            console.log(
                `✅ 完了: ${row.game_id} ` +
                `(${generated.pngCount}枚)`
            );
        } catch (error) {
            failed.push({
                ...row,
                error:
                    error?.message ||
                    String(error),
            });

            console.error(
                `❌ 失敗: ${row.game_id}`
            );
            console.error(
                error?.message ||
                String(error)
            );
        }

        console.log();
    }

    const completedPath = path.join(
        LOG_ROOT,
        "b2_game_players_completed_ids.txt"
    );

    const failedPath = path.join(
        LOG_ROOT,
        "b2_game_players_failed_ids.txt"
    );

    fs.writeFileSync(
        completedPath,
        completed
            .map(row =>
                [
                    row.game_date,
                    row.game_id,
                    row.pngCount,
                    row.folder,
                ].join("\t")
            )
            .join("\n") +
            (completed.length ? "\n" : ""),
        "utf8"
    );

    fs.writeFileSync(
        failedPath,
        failed
            .map(row =>
                [
                    row.game_date,
                    row.game_id,
                    row.error,
                ].join("\t")
            )
            .join("\n") +
            (failed.length ? "\n" : ""),
        "utf8"
    );

    console.log(
        "===== 一括生成結果 ====="
    );
    console.log(
        `成功: ${completed.length}`
    );
    console.log(
        `失敗: ${failed.length}`
    );
    console.log(
        `生成済みスキップ: ${skippedRows.length}`
    );
    console.log(
        `成功ログ: ${completedPath}`
    );
    console.log(
        `失敗ログ: ${failedPath}`
    );

    if (failed.length > 0) {
        process.exitCode = 1;
    }
}

run().catch(error => {
    console.error(
        "❌ 一括生成処理を開始できません:",
        error.message
    );
    process.exitCode = 1;
});
