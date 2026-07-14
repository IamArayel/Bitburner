export async function main(ns) {
  const doc = eval("document");
  const el = doc.getElementById("unclickable");
  if (!el) { ns.tprint("ERREUR: élément unclickable pas trouvé"); return; }
  const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
  if (!key) { ns.tprint("ERREUR: props react pas trouvé"); return; }
  const onClick = el[key].onClick;
  if (typeof onClick !== "function") { ns.tprint("ERREUR: onClick pas trouvé"); return; }
  onClick({ target: el, isTrusted: true });
  ns.tprint("Clic simulé. Regarde le succès.");
}
