export async function main(ns) {
  const doc = eval("document");
  const root = doc.getElementById("root");
  let rootFiber = null;
  for (const key in root) if (key.startsWith("__react")) { rootFiber = root[key]; break; }
  if (!rootFiber) { ns.tprint("ERREUR: fiber racine pas trouve"); return; }

  const seen = new Set();
  const stack = [rootFiber];
  let dispatch = null;

  while (stack.length && !dispatch) {
    const f = stack.pop();
    if (!f || seen.has(f)) continue;
    seen.add(f);

    let hook = f.memoizedState;
    while (hook && typeof hook === "object" && "queue" in hook) {
      const val = hook.memoizedState;
      if (Array.isArray(val) && val.length > 0 && val[0] && typeof val[0] === "object" && "page" in val[0] && hook.queue?.dispatch) {
        dispatch = hook.queue.dispatch;
        break;
      }
      hook = hook.next;
    }

    if (f.child) stack.push(f.child);
    if (f.sibling) stack.push(f.sibling);
  }

  if (!dispatch) { ns.tprint("ERREUR: state pages pas trouvé"); return; }
  dispatch([{ page: "Dev" }]);
  ns.tprint("Menu dev force ouvert.");
}
