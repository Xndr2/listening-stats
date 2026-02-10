const React = Spicetify.React;

interface DraggableSectionProps {
  id: string;
  children: React.ReactNode;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  dropPosition: "before" | "after" | null;
}

/** Six-dot grip icon for drag handle */
function GripIcon() {
  return (
    <svg
      className="drag-grip-icon"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="5.5" cy="3" r="1.5" />
      <circle cx="10.5" cy="3" r="1.5" />
      <circle cx="5.5" cy="8" r="1.5" />
      <circle cx="10.5" cy="8" r="1.5" />
      <circle cx="5.5" cy="13" r="1.5" />
      <circle cx="10.5" cy="13" r="1.5" />
    </svg>
  );
}

/**
 * Wrapper component that makes a dashboard section reorderable via drag-and-drop.
 * Only the drag handle is draggable -- child content retains all click interactions.
 */
export function DraggableSection({
  id,
  children,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  dropPosition,
}: DraggableSectionProps) {
  const wrapperClass =
    "draggable-section" + (isDragging ? " is-dragging" : "");

  return (
    <div
      className={wrapperClass}
      onDragOver={(e: React.DragEvent<HTMLDivElement>) => onDragOver(e, id)}
      onDrop={(e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        onDrop(e, id);
      }}
    >
      {dropPosition === "before" && <div className="drop-indicator" />}
      <div
        className="section-drag-handle"
        draggable={true}
        onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", id);
          onDragStart(id);
        }}
        onDragEnd={() => onDragEnd()}
      >
        <GripIcon />
      </div>
      {children}
      {dropPosition === "after" && <div className="drop-indicator" />}
    </div>
  );
}
