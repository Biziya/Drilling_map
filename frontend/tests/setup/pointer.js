// jsdom has no PointerEvent, so fireEvent.pointerMove(...) arrives as a plain
// Event without clientX/buttons, and no pointer capture. The maps hit-test and
// pan on pointer events, so tests get a MouseEvent-based stand-in.
globalThis.PointerEvent ??= class PointerEvent extends MouseEvent {
  constructor(type, init = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
};
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
