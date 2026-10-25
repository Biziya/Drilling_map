// jsdom has no 2D canvas (getContext only logs "Not implemented"). The Techno
// Map draws its markers on one, so tests get a minimal context that records
// what was drawn: `canvas.__calls` lists [method, ...args] since the last
// clearRect, which is the start of every frame.

function createContext(canvas) {
  const calls = [];
  canvas.__calls = calls;
  const record = (name) => (...args) => { calls.push([name, ...args]); };

  return {
    canvas,
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    lineCap: "butt",
    shadowColor: "transparent",
    shadowBlur: 0,
    shadowOffsetY: 0,
    clearRect: (...args) => { calls.length = 0; calls.push(["clearRect", ...args]); },
    setTransform: record("setTransform"),
    scale: record("scale"),
    translate: record("translate"),
    beginPath: record("beginPath"),
    closePath: record("closePath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    arc: record("arc"),
    fill: record("fill"),
    stroke: record("stroke"),
    drawImage: record("drawImage"),

    // Text metrics, for the Weekly Geos charts. ECharts measures every
    // axis label before it lays an axis out, and does so through a 2D
    // context even when it renders to SVG, so without these it throws
    // rather than drawing.
    //
    // Deliberately NOT recorded: the map tests read `__calls` to assert
    // what was drawn on a frame, and measuring is not drawing.
    font: "12px sans-serif",
    textAlign: "left",
    textBaseline: "alphabetic",
    measureText: (text) => ({
      // Roughly 6px a character at the chart label sizes. Nothing asserts
      // on the number; it only has to be finite and to grow with the
      // string, or ECharts' overlap checks divide by zero.
      width: String(text).length * 6,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
    }),
    save: () => {},
    restore: () => {},
    rect: () => {},
    clip: () => {},
    fillText: () => {},
    strokeText: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
  };
}

const contexts = new WeakMap();
HTMLCanvasElement.prototype.getContext = function getContext(type) {
  if (type !== "2d") return null;
  if (!contexts.has(this)) contexts.set(this, createContext(this));

  return contexts.get(this);
};
