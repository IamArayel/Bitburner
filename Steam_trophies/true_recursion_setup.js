export async function main(ns) {
  const win = eval("window");
  win.__capturedListeners = win.__capturedListeners || [];
  const original = win.addEventListener.bind(win);
  win.addEventListener = function (type, listener, options) {
    if (type === "message") win.__capturedListeners.push(listener);
    return original(type, listener, options);
  };
  ns.tprint("Patch pose. Va a New Tokyo > Arcade > Megabyte burner 2000, PUIS lance true_recursion_trigger.js.");
}
