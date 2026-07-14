export async function main(ns) {
  const win = eval("window");
  const listeners = win.__capturedListeners || [];
  if (listeners.length === 0) {
    ns.tprint("ERREUR: aucun listener capture. Va bien dans l'Arcade (New Tokyo) d'abord.");
    return;
  }
  const fakeEvent = { isTrusted: true, origin: "https://bitburner-official.github.io", data: true };
  for (const l of listeners) l(fakeEvent);
  ns.tprint("Message simule envoye. Regarde le succes.");
}
