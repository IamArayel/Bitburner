export async function main(ns) {
  const target = 1000;
  const worker = "/Steam_trophies/noop.js";

  const visited = new Set(["home"]);
  const queue = ["home"];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of ns.scan(cur)) if (!visited.has(n)) { visited.add(n); queue.push(n); }
  }
  const servers = [...visited, ...ns.cloud.getServerNames()].filter(s => ns.hasRootAccess(s));
  for (const s of servers) if (s !== "home") await ns.scp(worker, s, "home");

  while (true) {
    let running = 0;
    for (const s of servers) running += ns.ps(s).filter(p => p.filename === worker).length;
    if (running >= target) { ns.tprint(`SUCCES: ${running} scripts actifs`); return; }

    for (const s of servers) {
      const cost = ns.getScriptRam(worker, s);
      let free = ns.getServerMaxRam(s) - ns.getServerUsedRam(s);
      while (free >= cost && running < target) {
        if (ns.exec(worker, s, 1) === 0) break;
        free -= cost;
        running++;
      }
    }
    await ns.sleep(1000);
  }
}
