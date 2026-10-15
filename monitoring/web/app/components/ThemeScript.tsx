// Runs before first paint to apply the saved theme, so there is no flash of
// the wrong surface on reload. Must be a blocking inline script, not a client
// component — a React effect runs after hydration and is too late.
//
// Kept deliberately small: no storage access until after DOM is ready, and a
// try/catch so private-mode browsers cannot break the page over a theme.

const THEME_KEY = "ts-theme";

export function ThemeScript() {
  const script = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}