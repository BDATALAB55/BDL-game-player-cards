const fs = require("fs");
const path = require("path");

// 比較用に名前をクリーンアップ
const toKey = (s) => s ? s.split(/[\n\r]/)[0].replace(/[A-Za-z\s　・.#\d-]/g, "").replace(/"/g, "").trim() : "";

function finalBuild() {
    const rawDir = path.join(process.cwd(), "data", "raw");
    const outPath = path.join(process.cwd(), "data", "all_players_stats.json");

    const loadCsv = (name) => {
        const p = path.join(rawDir, name);
        if (!fs.existsSync(p)) return [];
        const buf = fs.readFileSync(p);
        // Shift-JISでデコード
        const txt = new (require('util').TextDecoder)('shift_jis').decode(buf).replace(/\r\n/g, "\n");
        const rows = txt.split("\n").map(line => {
            return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
        });
        // 選手名が入っている行をヘッダーとして特定し、そこから下を返す
        const startIdx = rows.findIndex(r => r.some(c => c.includes("カルバー") || c.includes("ニック")));
        return startIdx !== -1 ? rows.slice(startIdx) : rows.filter(r => r.length > 5);
    };

    const rowsT = loadCsv("合計-表1.csv");
    const rowsR = loadCsv("RTG-表1.csv");
    const rowsD = loadCsv("詳細-表1.csv");

    // RTGデータの座標特定 (アップロードファイルより: 1:Player, 2:Age, 8:USG%, 9:TS%, 10:eFG%)
    const rtgMap = {};
    rowsR.forEach(r => {
        const k = toKey(r[1]);
        if (k) rtgMap[k] = { age: r[2], usg: r[8], ts: r[9], efg: r[10], ortg: r[5] };
    });

    // 詳細データの座標特定 (3:2ND, 4:FB, 5:PITP)
    const detailMap = {};
    rowsD.forEach(r => {
        const k = toKey(r[1]);
        if (k) detailMap[k] = { s2: r[3], fb: r[4], pt: r[5] };
    });

    const finalResult = rowsT.map(r => {
        const rawName = r[1];
        const nameK = toKey(rawName);
        if (!nameK || nameK === "選手" || nameK === "Player") return null;

        const rm = rtgMap[nameK] || {};
        const dm = detailMap[nameK] || {};
        
        // 合計CSVのインデックス (アップロードファイルの実測値)
        const g = parseFloat(r[3]) || 1;
        const pts = parseFloat(r[7]) || 0;

        return {
            nameJp: rawName.split(/[\n\r]/)[0],
            team: r[2],
            age: rm.age || "---",
            usg: rm.usg || "0.0%",
            ortg: rm.ortg || "0.0",
            ts: rm.ts || "0.0%",
            efg: rm.efg || "0.0%",
            g: g.toString(),
            gs: r[4],
            min: r[6],
            pts: (pts / g).toFixed(1),
            f2gm: (parseFloat(r[11]) / g).toFixed(1),
            f2ga: (parseFloat(r[12]) / g).toFixed(1),
            f2p: r[13],
            f3gm: (parseFloat(r[14]) / g).toFixed(1),
            f3ga: (parseFloat(r[15]) / g).toFixed(1),
            f3p: r[16],
            ftm: (parseFloat(r[17]) / g).toFixed(1),
            fta: (parseFloat(r[18]) / g).toFixed(1),
            ftp: r[19],
            trb: (parseFloat(r[22]) / g).toFixed(1),
            ast: (parseFloat(r[23]) / g).toFixed(1),
            tov: (parseFloat(r[24]) / g).toFixed(1),
            stl: (parseFloat(r[25]) / g).toFixed(1),
            blk: (parseFloat(r[26]) / g).toFixed(1),
            eff: (parseFloat(r[30]) / g).toFixed(1),
            pts2nd: (parseFloat(dm.s2 || 0) / g).toFixed(1),
            ptsFb: (parseFloat(dm.fb || 0) / g).toFixed(1),
            ptsPaint: (parseFloat(dm.pt || 0) / g).toFixed(1),
            ptsRatio2: pts ? Math.round(((parseFloat(r[11]) * 2) / pts) * 100) : 0,
            ptsRatio3: pts ? Math.round(((parseFloat(r[14]) * 3) / pts) * 100) : 0,
            ptsRatioFt: pts ? Math.round((parseFloat(r[17]) / pts) * 100) : 0
        };
    }).filter(v => v && v.team && v.team.length < 10);

    fs.writeFileSync(outPath, JSON.stringify(finalResult, null, 2), "utf-8");
    console.log(`✅ 今度こそ完了: ${finalResult.length}名`);
    if (finalResult.length > 0) {
        console.log(`📊 照合成功: ${finalResult[0].nameJp} (Age: ${finalResult[0].age}, USG: ${finalResult[0].usg})`);
    }
}
finalBuild();