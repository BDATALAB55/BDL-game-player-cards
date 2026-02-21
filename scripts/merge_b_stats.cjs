const fs = require("fs");
const path = require("path");

function parseCSV(filePath) {
    // ファイルが存在するかチェック
    if (!fs.existsSync(filePath)) {
        throw new Error(`ファイルが見つかりません: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const rows = [];
    let currentRow = [];
    let currentToken = "";
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentToken.trim());
            currentToken = "";
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (currentToken || currentRow.length > 0) {
                currentRow.push(currentToken.trim());
                rows.push(currentRow);
                currentToken = "";
                currentRow = [];
            }
        } else {
            currentToken += char;
        }
    }
    
    // ヘッダー取得 (BリーグのCSVは2行目以降に実データがある場合があるので空行を飛ばす)
    const validRows = rows.filter(r => r.length > 1);
    const headers = validRows[0].map(h => h.replace(/"/g, '').trim());
    
    return validRows.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, i) => {
            if (row[i] !== undefined) obj[header] = row[i].replace(/"/g, '').trim();
        });
        return obj;
    });
}

function cleanPlayerName(rawName) {
    if (!rawName) return "";
    // 改行コード(\n または \r\n)で分割して名前部分だけ抽出
    return rawName.split(/[\r\n]+/)[0].trim();
}

function mergeAll() {
    const rawDir = path.join(process.cwd(), "data", "raw");
    const outDir = path.join(process.cwd(), "data", "players");
    
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const files = {
        total: path.join(rawDir, "合計-表1.csv"),
        detail: path.join(rawDir, "詳細-表1.csv"),
        rtg: path.join(rawDir, "RTG-表1.csv")
    };

    const players = {};

    try {
        console.log("1/3: 合計データを処理中...");
        const totalData = parseCSV(files.total);
        totalData.forEach(row => {
            const name = cleanPlayerName(row["選手"]);
            if (!name || name === "選手" || !row["G"]) return;

            // 背番号とポジションを抽出 (#8SG/SF みたいな形式)
            const profile = row["選手"] || "";
            const noMatch = profile.match(/#(\d+)/);
            const posMatch = profile.match(/#\d+\s*(.*)/) || profile.match(/\n(.*)/);
            
            players[name] = {
                nameJp: name,
                no: noMatch ? noMatch[1] : "",
                pos: posMatch ? posMatch[1].trim() : "",
                team: row["クラブ"],
                g: row["G"],
                gs: row["GS"],
                min: row["MINPG"],
                pts: (parseFloat(row["PTS"]) / parseFloat(row["G"])).toFixed(1),
                f2p: row["2FG%"],
                f3p: row["3FG%"],
                ftp: row["FT%"],
                reb: (parseFloat(row["TR"]) / parseFloat(row["G"])).toFixed(1),
                ast: (parseFloat(row["AS"]) / parseFloat(row["G"])).toFixed(1),
                stl: (parseFloat(row["ST"]) / parseFloat(row["G"])).toFixed(1),
                blk: (parseFloat(row["BS"]) / parseFloat(row["G"])).toFixed(1),
                tov: (parseFloat(row["TO"]) / parseFloat(row["G"])).toFixed(1),
            };
        });

        console.log("2/3: 詳細データをマージ中...");
        const detailData = parseCSV(files.detail);
        detailData.forEach(row => {
            const name = cleanPlayerName(row["選手"]);
            if (players[name]) {
                const g = parseFloat(players[name].g);
                players[name].secondPts = (parseFloat(row["2NDPTS"]) / g).toFixed(1);
                players[name].fastBreakPts = (parseFloat(row["FBPS"]) / g).toFixed(1);
                players[name].paintPts = (parseFloat(row["PITP"]) / g).toFixed(1);
                players[name].efg = row["EFG%"];
                players[name].ts = row["TS%"];
            }
        });

        console.log("3/3: アドバンスド(RTG)データをマージ中...");
        const rtgData = parseCSV(files.rtg);
        rtgData.forEach(row => {
            const name = cleanPlayerName(row["Player"]);
            if (players[name]) {
                players[name].usg = row["USG%"];
                players[name].ortg = row["ORTG"];
                players[name].drtg = row["DRTG"];
            }
        });

        // JSON保存
        console.log("ファイルを書き出し中...");
        Object.values(players).forEach(p => {
            fs.writeFileSync(
                path.join(outDir, `stats_${p.nameJp}.json`),
                JSON.stringify(p, null, 2)
            );
        });

        console.log(`\n✅ 完了！ ${Object.keys(players).length} 名の選手データを統合しました。`);
        console.log(`出力先: ${outDir}`);

    } catch (e) {
        console.error(`\n❌ エラーが発生しました:\n${e.message}`);
    }
}

mergeAll();