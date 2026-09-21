// Width of the planner canvas coordinate space ("canvas units"), shared by every figure.
//
// The SVG viewBox, marker sizes, font sizes and grid/strip geometry are all expressed in
// these units. Every figure is drawn at this same width; its canvas height follows the
// figure's own aspect ratio (see canvasHeight() in ./figures). That keeps markers and
// labels the same on-screen size whichever figure is loaded.
//
// This is deliberately NOT the native pixel size of a figure image. Library coordinates
// (anatomy-library*.csv, superior-inferior-regions*.json, brain-regions*.json) are in the
// figure's native pixels -- see FIGURES in ./figures.
export const REF_W = 1770;
