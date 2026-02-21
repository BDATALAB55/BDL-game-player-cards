const fs = require("fs");
const path = require("path");

function parseCSV(filePath) {
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const rows = [];
    let currentRow = [];
    let currentToken = "";
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === ',' && !inQuotes) { currentRow.push(currentToken.trim()); currentToken = ""; }
        else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (currentToken || currentRow.length > 0) {
                currentRow.push(currentToken.trim());
                rows.push(currentRow);
                currentToken = "";
                currentRow = [];
            }
        } else { currentToken += char; }
    }
    const validRows = rows.filter(r => r.length > 1);
    const headers = validRows[0].map(h => h.replace(/"/g, '').trim());
    return validRows.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, i) => { if (row[i] !== undefined) obj[header] = row[i].replace(/"/g, '').trim(); });
        return obj;
    });
}

function cleanPlayerName(rawName) {
    if (!rawName) return "";
    return rawName.split(/[\r\n]+/)[0].trim();
}

function mergeAllInOne() {
    const rawDir = path.join(process.cwd(), "data", "raw");
    const outDir = path.join(process.cwd(), "data");
    const files = {
        total: path.join(rawDir, "合計-表1.csv"),
        detail: path.join(rawDir, "詳細-表1.csv"),
        rtg: path.join(rawDir, "RTG-表1.csv")
    };

    const allPlayers = {};

    try {
        console.log("データの統合を再実行します...");
        
        // 1. 合計データ (ベース作成)
        parseCSV(files.total).forEach(row => {
            const rawNameField = row["選手"];
            const nameJp = cleanPlayerName(rawNameField);
            if (!nameJp || nameJp === "選手" || !row["G"]) return;

            const noMatch = rawNameField.match(/#(\d+)/);
            const posMatch = rawNameField.match(/#\d+\s*([A-Z/]+)/) || rawNameField.match(/\n#(.*)/);
            const games = parseFloat(row["G"]) || 1;
            const toAvg = (val) => (parseFloat(val) / games).toFixed(1);

            allPlayers[nameJp] = {
                nameJp: nameJp,
                nameEn: "---",
                no: noMatch ? noMatch[1] : "",
                pos: posMatch ? posMatch[1].trim() : "",
                team: row["クラブ"],
                age: "---",
                ht: "---",
                g: row["G"],
                gs: row["GS"],
                min: row["MINPG"],
                pts: toAvg(row["PTS"]),
                f2m: toAvg(row["2FGM"]), f2a: toAvg(row["2FGA"]), f2p: row["2FG%"],
                f3m: toAvg(row["3FGM"]), f3a: toAvg(row["3FGA"]), f3p: row["3FG%"],
                ftm: toAvg(row["FTM"]), fta: toAvg(row["FTA"]), ftp: row["FT%"],
                orb: toAvg(row["OR"]), drb: toAvg(row["DR"]), trb: toAvg(row["TR"]),
                ast: toAvg(row["AS"]), stl: toAvg(row["ST"]), blk: toAvg(row["BS"]),
                tov: toAvg(row["TO"]), pf: toAvg(row["F"]), fd: toAvg(row["FD"]),
                eff: toAvg(row["EFF"]),
                // 初期化（後で上書き）
                usg: "", ortg: "", drtg: "", secondPts: "", fastBreakPts: "", paintPts: "", efg: "", ts: ""
            };
        });

        // 2. RTGデータ (英語名, 年齢, USG, ORTG, DRTG)
        parseCSV(files.rtg).forEach(row => {
            const nameJp = cleanPlayerName(row["Player"]);
            if (allPlayers[nameJp]) {
                allPlayers[nameJp].nameEn = row["Player"] ? row["Player"].split(/[\r\n]+/)[0].trim() : "---";
                allPlayers[nameJp].age = row["Age"] || "---";
                allPlayers[nameJp].usg = row["USG%"] || "";
                allPlayers[nameJp].ortg = row["ORTG"] || "";
                allPlayers[nameJp].drtg = row["DRTG"] || "";
            }
        });

        // 3. 詳細データ (2ndPts, FBPS, PITP, EFG, TS)
        parseCSV(files.detail).forEach(row => {
            const nameJp = cleanPlayerName(row["選手"]);
            if (allPlayers[nameJp]) {
                const g = parseFloat(allPlayers[nameJp].g) || 1;
                allPlayers[nameJp].secondPts = (parseFloat(row["2NDPTS"]) / g).toFixed(1);
                allPlayers[nameJp].fastBreakPts = (parseFloat(row["FBPS"]) / g).toFixed(1);
                allPlayers[nameJp].paintPts = (parseFloat(row["PITP"]) / g).toFixed(1);
                allPlayers[nameJp].efg = row["EFG%"] || "";
                allPlayers[nameJp].ts = row["TS%"] || "";
            }
        });

        const finalArray = Object.values(allPlayers);
        fs.writeFileSync(path.join(outDir, "all_players_stats.json"), JSON.stringify(finalArray, null, 2));

        console.log(`\n✅ 完了！ORTG/DRTGを保持したまま、${finalArray.length} 名のデータを統合しました。`);

    } catch (e) {
        console.error(`❌ エラー: ${e.message}`);
    }
}

mergeAllInOne();