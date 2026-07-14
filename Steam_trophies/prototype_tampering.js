export async function main(ns) {
  const win = eval("window");
  win.Number.prototype.toExponential = () => "tampered";
  ns.tprint("Number.prototype.toExponential trafiqué.");
  ns.tprint("Attends jusqu'à 15 minutes (vérif interne toutes les 15 min).");
  ns.tprint("Recharge la page (F5) après le succes pour réparer l'affichage des nombres.");
}
