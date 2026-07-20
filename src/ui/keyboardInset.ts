export function computeKeyboardInset(
  layoutHeight: number,
  visualHeight: number,
  visualOffsetTop: number,
): number {
  return Math.max(0, layoutHeight - visualHeight - visualOffsetTop);
}

export function isKeyboardAdjustedElement(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  return element.matches(".composer textarea, [data-edit-textarea]");
}

export function bindKeyboardInset(
  root: HTMLElement = document.documentElement,
): () => void {
  const viewport = window.visualViewport;
  let frame = 0;

  const update = () => {
    frame = 0;
    const activeElement = document.activeElement;
    const shouldApply = isKeyboardAdjustedElement(activeElement);
    const inset =
      shouldApply && viewport
        ? computeKeyboardInset(
            window.innerHeight,
            viewport.height,
            viewport.offsetTop,
          )
        : 0;
    root.style.setProperty("--keyboard-inset", `${inset}px`);
    if (shouldApply) {
      activeElement?.scrollIntoView({ block: "nearest" });
    }
  };

  const schedule = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };

  viewport?.addEventListener("resize", schedule);
  viewport?.addEventListener("scroll", schedule);
  window.addEventListener("resize", schedule);
  document.addEventListener("focusin", schedule);
  document.addEventListener("focusout", schedule);
  schedule();

  return () => {
    if (frame) cancelAnimationFrame(frame);
    viewport?.removeEventListener("resize", schedule);
    viewport?.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    document.removeEventListener("focusin", schedule);
    document.removeEventListener("focusout", schedule);
    root.style.removeProperty("--keyboard-inset");
  };
}
