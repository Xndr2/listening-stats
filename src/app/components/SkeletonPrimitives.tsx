interface SkeletonBlockProps extends React.HTMLAttributes<HTMLDivElement> {
	width?: string | number;
	height?: string | number;
	radius?: string | number;
}

export function SkeletonBlock({
	width = "100%",
	height = "12px",
	radius = 4,
	style,
	className,
	...rest
}: SkeletonBlockProps) {
	return (
		<div
			{...rest}
			className={`skeleton-shimmer${className ? ` ${className}` : ""}`}
			style={{
				width,
				height,
				borderRadius: radius,
				...style,
			}}
		/>
	);
}

export function SkeletonCircle({ size = 20, style }: { size?: number; style?: React.CSSProperties }) {
	return <SkeletonBlock width={size} height={size} radius="50%" style={style} />;
}

export function SkeletonTextLine({ width = "70%" }: { width?: string | number }) {
	return <SkeletonBlock width={width} height="10px" radius={4} />;
}
