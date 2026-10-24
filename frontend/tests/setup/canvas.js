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
  };
}

const contexts = new WeakMap();
HTMLCanvasElement.prototype.getContext = function getContext(type) {
  if (type !== "2d") return null;
  if (!contexts.has(this)) contexts.set(this, createContext(this));

  return contexts.get(this);
};
