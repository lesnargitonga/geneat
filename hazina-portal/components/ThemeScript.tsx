export function ThemeScript() {
  const code = `
(() => {
  try {
    const stored = window.localStorage.getItem("hazina.theme");
    const prefersNight = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored || (prefersNight ? "night" : "day");
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "day";
  }
})();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
