/** @param {NS} ns **/
export async function main(ns) {

    const TARGET_LEVEL = 1000;
    const SAMPLE_WINDOW_SECONDS = 30;

    if (!ns.fileExists("Formulas.exe", "home")) {
        ns.tprint("ERROR : Formulas.exe required.");
        return;
    }

    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.ui.resizeTail(470, 265);

    const mult = ns.getPlayer().mults.hacking;

    let xpSamples = [];
    let lastXp = ns.getPlayer().exp.hacking;
    let lastTime = Date.now();

    while (true) {
        await ns.sleep(1000);

        const now = Date.now();
        const currentXp = ns.getPlayer().exp.hacking;
        const currentLevel = ns.getHackingLevel();

        // ===== real XP/s =====
        const deltaXp = currentXp - lastXp;
        const deltaTime = (now - lastTime) / 1000;

        if (deltaXp > 0 && deltaTime > 0) {
            xpSamples.push(deltaXp / deltaTime);
            if (xpSamples.length > SAMPLE_WINDOW_SECONDS) {
                xpSamples.shift();
            }
        }

        const confident = xpSamples.length >= SAMPLE_WINDOW_SECONDS;
        const xpPerSecond = confident
            ? xpSamples.reduce((a, b) => a + b, 0) / xpSamples.length
            : 0;

        // ===== NEXT LEVEL =====
        const levelFromXp = Math.floor(
            ns.formulas.skills.calculateSkill(currentXp, mult)
        );

        const xpNextLevel =
            ns.formulas.skills.calculateExp(levelFromXp + 1, mult);

        const xpRemainingInLevel = Math.max(0, xpNextLevel - currentXp);

        // ===== FINAL TARGET =====
        const xpTarget =
            ns.formulas.skills.calculateExp(TARGET_LEVEL, mult);

        const xpRemainingToTarget =
            Math.max(0, xpTarget - currentXp);

        // ===== DISPLAY =====
        ns.clearLog();
        ns.print("===  HACKING PROGRESS ===");
        ns.print(`Current level  : ${currentLevel}`);
        ns.print(`XP/s average   : ${confident ? ns.format.number(xpPerSecond) : "—"}`);
        ns.print(`Samples        : ${xpSamples.length}/${SAMPLE_WINDOW_SECONDS}`);
        ns.print("----------------------------------------");

        if (confident && xpPerSecond > 0) {
            ns.print(
                `Next level     : ${ns.format.time((xpRemainingInLevel / xpPerSecond) * 1000)}`
            );
        } else {
            ns.print("Next level     : analyzing...");
        }

        ns.print("----------------------------------------");
        //ns.print(`Objectif final       : niveau ${TARGET_LEVEL}`);

        //if (confident && xpPerSecond > 0) {
        //    ns.print(
        //        `Temps restant       : ${ns.format.time((xpRemainingToTarget / xpPerSecond) 
        //        //* 1000
        //        )}`
        //    );
        //} else {
        //    ns.print("Temps restant       : analyzing...");
        //}

        lastXp = currentXp;
        lastTime = now;
    }
}
