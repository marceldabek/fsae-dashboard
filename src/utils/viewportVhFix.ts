// src/utils/viewportVhFix.ts
function setVhVar() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--app-vh', `${vh * 100}px`);
}

export function installViewportVhFix() {
  setVhVar();
  const vv = (window as any).visualViewport;
  window.addEventListener('resize', setVhVar);
  window.addEventListener('orientationchange', setVhVar);
  if (vv) vv.addEventListener('resize', setVhVar);
}
