export async function main(ns) {
  const win = eval("window");
  win.setTimeout = new Proxy(win.setTimeout, {
    apply: (target, thisArg, args) => target.apply(thisArg, [args[0], 0, ...args.slice(2)]),
  });
  ns.tprint("Temps compressé. Attends 15-20s, succès doit pop.");
  ns.tprint("Recharge la page du jeu après (F5) pour remettre le timing normal.");
}
