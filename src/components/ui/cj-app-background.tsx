/**
 * Cajupar global app background.
 * Renderiza UMA vez no root (App.tsx), fixed em z-index -1.
 * Não captura eventos. Respeita prefers-reduced-motion via CSS.
 */
export function CJAppBackground() {
  return (
    <div className="cj-app-bg" aria-hidden="true">
      <div className="cj-app-bg__blob cj-app-bg__blob--1" />
      <div className="cj-app-bg__blob cj-app-bg__blob--2" />
    </div>
  );
}

export default CJAppBackground;
