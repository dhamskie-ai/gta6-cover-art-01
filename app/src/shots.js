// Fixed scenes for screenshots: ?shot=cover shows the cover alone at the
// chosen export size; ?shot=editor shows the full editor with a sample
// photo loaded. `photo` picks the sample (samples/<photo>.jpg), `caption`
// the title, and `layout`, `grade` and `size` pick the look.
// window.__shotReady is set once the cover has painted.
export async function runShot(shot, query, load) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  if (shot === 'editor') document.body.classList.add('shot-editor');
  const options = {
    layout: query.get('layout') ?? undefined,
    grade: query.get('grade') ?? undefined,
    size: query.get('size') ?? undefined,
  };
  await load(query.get('photo') ?? 'pier', query.get('caption') ?? 'Sunset Heist', options);
  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
