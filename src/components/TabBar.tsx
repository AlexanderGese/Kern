// src/components/TabBar.tsx — nav arrows + one tab per open file (§5.6, §6.2).
// Click to switch, hover-× to close, middle-click closes. Unsaved = faint dot.
import { useStore, isDirty, type Tab } from "../store/useStore";

export function TabBar() {
  const tabs = useStore((s) => s.tabs);
  const activePath = useStore((s) => s.activePath);
  const setActive = useStore((s) => s.setActive);
  const closeTab = useStore((s) => s.closeTab);
  const nextTab = useStore((s) => s.nextTab);

  return (
    <div className="tabbar">
      <div className="tabbar__nav">
        <button className="tabbar__navbtn" title="Previous tab" onClick={() => nextTab(-1)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 3 L5 8 L10 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="tabbar__navbtn" title="Next tab" onClick={() => nextTab(1)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M6 3 L11 8 L6 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="tabbar__tabs">
        {tabs.map((tab) => (
          <TabItem
            key={tab.path}
            tab={tab}
            active={tab.path === activePath}
            onSelect={() => setActive(tab.path)}
            onClose={() => closeTab(tab.path)}
          />
        ))}
      </div>
    </div>
  );
}

function TabItem({
  tab,
  active,
  onSelect,
  onClose,
}: {
  tab: Tab;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const dirty = isDirty(tab);
  return (
    <div
      className={"tab" + (active ? " is-active" : "")}
      onClick={onSelect}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          onClose();
        }
      }}
      title={tab.path}
    >
      <span className="tab__name">{tab.name}</span>
      {dirty ? (
        <span className="tab__dot" title="Unsaved changes" />
      ) : (
        <span
          className="tab__close"
          title="Close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          ×
        </span>
      )}
    </div>
  );
}
