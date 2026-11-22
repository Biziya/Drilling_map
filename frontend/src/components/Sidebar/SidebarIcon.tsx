import explorationMap from '../../assets/sidebar/icon-exploration-map.svg?raw';
import technoMap from '../../assets/sidebar/icon-techno-map.svg?raw';
import drillingDetails from '../../assets/sidebar/icon-drilling-details.svg?raw';
import drillingByRig from '../../assets/sidebar/icon-drilling-by-rig.svg?raw';

/**
 * The sidebar's page icons, one SVG file each in assets/sidebar. They are
 * outline drawings on a 24×24 grid in `currentColor` with no background, and
 * are placed inline (not as <img>) so they take the link's text colour: muted,
 * brand on hover, white when active.
 */
export type SidebarIconName = 'exploration-map' | 'techno-map' | 'drilling-details' | 'drilling-by-rig';

/** Drops the files' comments and the whitespace between tags, which would otherwise join the link's text. */
const compact = (svg: string) => svg.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').trim();

const SOURCES: Readonly<Record<SidebarIconName, string>> = {
  'exploration-map': compact(explorationMap),
  'techno-map': compact(technoMap),
  'drilling-details': compact(drillingDetails),
  'drilling-by-rig': compact(drillingByRig),
};

/** The `.sidebar__icon` box holding one page icon; hidden from screen readers, as the label names the page. */
export default function SidebarIcon({ name }: { name: SidebarIconName }) {
  const source = SOURCES[name];

  // Our own static files, bundled at build time: safe to place inline.
  return <span className="sidebar__icon" aria-hidden="true" dangerouslySetInnerHTML={source ? { __html: source } : undefined} />;
}
