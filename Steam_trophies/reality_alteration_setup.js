export async function main(ns) {
  const win = eval("window");
  const originalWarn = win.console.warn.bind(win.console);
  win.console.warn = function (...args) {
    if (args[0] === "I am sure that this variable is false.") {
      debugger;
    }
    return originalWarn(...args);
  };
  ns.tprint("Patch pose. Ouvre DevTools (F12) MAINTENANT, puis lance reality_alteration_trigger.js.");
}
