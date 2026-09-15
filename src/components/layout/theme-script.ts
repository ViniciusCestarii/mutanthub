export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "mutanthub-theme";

/**
 * Inline bootstrap that applies the stored or system theme before the first
 * paint, so there is no flash of the wrong theme. Rendered by the root layout
 * (a Server Component) with the per-request CSP nonce.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var t=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var r=document.documentElement;r.classList.toggle("dark",t==="dark");r.classList.toggle("light",t==="light");r.style.colorScheme=t;}catch(e){}})();`;
