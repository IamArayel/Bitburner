const TARGET_SCRIPT = "Steam_trophies/Youre_not_meant_to_access_this.js";
const BUTTON_ID = "cheat-button-injected";
const ICON_PATH =
  "M17.41 6.59 15 5.5l2.41-1.09L18.5 2l1.09 2.41L22 5.5l-2.41 1.09L18.5 9zm3.87 6.13L20.5 11l-.78 1.72-1.72.78 1.72.78.78 1.72.78-1.72L23 13.5zm-5.04 1.65 1.94 1.47-2.5 4.33-2.24-.94c-.2.13-.42.26-.64.37l-.3 2.4h-5l-.3-2.41c-.22-.11-.43-.23-.64-.37l-2.24.94-2.5-4.33 1.94-1.47c-.01-.11-.01-.24-.01-.36s0-.25.01-.37l-1.94-1.47 2.5-4.33 2.24.94c.2-.13.42-.26.64-.37L7.5 6h5l.3 2.41c.22.11.43.23.64.37l2.24-.94 2.5 4.33-1.94 1.47c.01.12.01.24.01.37s0 .24-.01.36M13 14c0-1.66-1.34-3-3-3s-3 1.34-3 3 1.34 3 3 3 3-1.34 3-3";

function findRowByLabel(doc, label) {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  while (node) {
    if (node.children.length === 0 && node.textContent.trim() === label) {
      let el = node;
      for (let i = 0; i < 6 && el; i++) {
        if (el.getAttribute?.("role") === "button") return el;
        el = el.parentElement;
      }
    }
    node = walker.nextNode();
  }
  return null;
}

let pendingRun = false;

function injectButton(doc) {
  const existing = doc.getElementById(BUTTON_ID);
  if (existing?.isConnected) return true;
  if (existing) existing.remove();

  const terminalRow = findRowByLabel(doc, "Terminal");
  if (!terminalRow?.parentElement) return false;

  const clone = terminalRow.cloneNode(true);
  clone.id = BUTTON_ID;
  clone.style.cursor = "pointer";

  const path = clone.querySelector("path");
  if (path) path.setAttribute("d", ICON_PATH);
  const svg = clone.querySelector("svg");
  if (svg) svg.dataset.testid = "SettingsSuggestIcon";

  const walker = doc.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  const textNode = walker.nextNode();
  if (textNode) textNode.textContent = "Cheats";

  clone.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    pendingRun = true;
  });

  terminalRow.parentElement.insertBefore(clone, terminalRow.nextSibling);
  return true;
}

export async function main(ns) {
  const doc = eval("document");
  ns.disableLog("ALL");
  while (true) {
    injectButton(doc);
    if (pendingRun) {
      pendingRun = false;
      try {
        const pid = ns.run(TARGET_SCRIPT);
        ns.tprint(pid ? `Bouton cheat: script lance (pid ${pid}).` : "Bouton cheat: ns.run a echoue (RAM insuffisante ou script deja actif).");
      } catch (err) {
        ns.tprint(`Bouton cheat: exception - ${err}`);
      }
    }
    await ns.sleep(300);
  }
}
