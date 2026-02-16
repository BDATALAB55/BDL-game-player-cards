const fs = require('fs');
const path = require('path');

// ターミナルの引数（node scripts/rename_cards.cjs R20 の "R20" 部分）を取得
const suffix = process.argv[2];

if (!suffix) {
    console.error("❌ エラー: 接尾語（R20など）を指定してください。");
    console.error("例: node scripts/rename_cards.cjs R20");
    process.exit(1);
}

const targetDir = path.join(process.cwd(), 'output', 'Team', 'B1');

/**
 * 【重要】自作したカードの番号（1.png, 2.png...）と対応する名前のリスト
 * 1番目のファイル(1.png) -> LEVANGA
 * 2番目のファイル(2.png) -> SENDAI
 * ... という順番で処理されます。
 */
const teamNames = [
    "LEVANGA",      // 1.png
    "89ERS",       // 2.png
    "NORTHERNHAPPINETS",        // 3.png
    "ROBOTS",      // 4.png
    "BREX",   // 5.png
    "CRANETHUNDERS",        // 6.png
    "ALPHAS",        // 7.png
    "ALTIRI",        // 8.png
    "JETS",        // 9.png
    "ALVARK", // 10.png
    "SUNROCKERS",      // 11.png
    "BRAVETHUNDERS",     // 12.png
    "B-CORSAIRS",     // 13.png
    "GROUSES",     // 14.png
    "NEOPHOENIX",        // 15.png
    "SEAHORSES ",       // 16.png
    "FIGHTINGEAGLES",    // 17.png
    "DIAMONDDOLPHINS",     // 18.png
    "LAKES",        // 19.png
    "HANNARYZ",        // 20.png
    "EVESSA",        // 21.png
    "SUSANOOMAGIC",      // 22.png
    "DRAGONFLIES",    // 23.png
    "BALLOONERS",         // 24.png
    "VELCA",     // 25.png
    "GOLDENKINGS"        // 26.png
];

function renameFiles() {
    if (!fs.existsSync(targetDir)) {
        console.error(`❌ フォルダが見つかりません: ${targetDir}`);
        return;
    }

    console.log(`🚀 リネーム開始 [設定: TS_(チーム名)_${suffix}.png]\n`);

    teamNames.forEach((name, index) => {
        const fileNumber = index + 1; // 1, 2, 3...
        const extensions = ['.png', '.jpg', '.jpeg'];
        
        let found = false;
        for (const ext of extensions) {
            const oldPath = path.join(targetDir, `${fileNumber}${ext}`);
            const newFileName = `TS_${name}_${suffix}${ext}`;
            const newPath = path.join(targetDir, newFileName);

            if (fs.existsSync(oldPath)) {
                fs.renameSync(oldPath, newPath);
                console.log(`✅ ${fileNumber}${ext} ➔ ${newFileName}`);
                found = true;
                break;
            }
        }

        if (!found) {
            console.log(`⚠️  ${fileNumber}.png/jpg が見つかりません。パス: ${targetDir}`);
        }
    });

    console.log("\n✨ すべての処理が完了しました！");
}

renameFiles();