const fs = require("fs");
const path = require("path");

// 比較用：記号・スペース・英語をすべて排除して「かな/漢字」だけにする
const superClean = (s) => s ? s.replace(/[A-Za-z\s　・.・()（）\-_]/g, "").trim() : "";

function update() {
    const statsPath = path.join(process.cwd(), "data", "all_players_stats.json");
    const masterPath = path.join(process.cwd(), "output", "rosters", "all_teams.json");

    const statsData = JSON.parse(fs.readFileSync(statsPath, "utf-8"));
    const masterData = JSON.parse(fs.readFileSync(masterPath, "utf-8"));

    console.log(`stats側: ${statsData.length}名 / master側: ${masterData.length}名`);

    let updateCount = 0;

    const updated = statsData.map(player => {
        const target = superClean(player.nameJp);
        
        // masterData側から「名前が含まれている」ものを探す
        const found = masterData.find(m => {
            const mName = superClean(m.name_ja || m.nameJp || "");
            return mName !== "" && (mName === target || mName.includes(target) || target.includes(mName));
        });

        if (found) {
            updateCount++;
            return {
                ...player,
                // 見つかったら英語名と身長を更新。なければ今の値を維持
                nameEn: found.name_en || found.nameEn || player.nameEn,
                ht: found.height_cm ? found.height_cm.toString() : (found.height || player.ht)
            };
        }
        return player;
    });

    fs.writeFileSync(statsPath, JSON.stringify(updated, null, 2), "utf-8");
    
    console.log(`✅ 完了！ ${updateCount} 名のプロフィールを更新しました。`);
    
    // 1人だけ中身を表示して確認
    const test = updated.find(p => p.nameJp.includes("カルバー"));
    if (test) {
        console.log("\n--- 抜き打ちチェック ---");
        console.log(`選手: ${test.nameJp}`);
        console.log(`英語名: ${test.nameEn}`);
        console.log(`身長: ${test.ht}`);
    }
}

update();