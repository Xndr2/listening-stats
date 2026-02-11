const { useState, useRef, useCallback } = Spicetify.React;

interface PortalTooltipProps {
  text: string;
  children: any;
  className?: string;
  style?: Record<string, any>;
}

export function PortalTooltip({ text, children, className, style }: PortalTooltipProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const onEnter = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
    setShow(true);
  }, []);

  const onLeave = useCallback(() => setShow(false), []);

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
      {show &&
        Spicetify.ReactDOM.createPortal(
          <div
            className="stat-tooltip-portal"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: "translate(-50%, -100%)",
              zIndex: 9990,
            }}
          >
            {text}
          </div>,
          document.body,
        )}
    </div>
  );
}
