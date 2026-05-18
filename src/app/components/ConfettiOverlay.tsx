const { useState, useEffect, useMemo } = Spicetify.React;

interface ConfettiOverlayProps {
	onComplete: () => void;
}

interface Particle {
	id: number;
	x: number;
	delay: number;
	duration: number;
	size: number;
	color: string;
	rotation: number;
}

const COLORS = [
	"var(--spice-button-active)",
	"var(--spice-text)",
	"#ff6b6b",
	"#ffd93d",
	"#6bcb77",
	"#4d96ff",
	"#ff6bff",
];

export function ConfettiOverlay({ onComplete }: ConfettiOverlayProps) {
	const particles: Particle[] = useMemo(() => {
		const out: Particle[] = [];
		for (let i = 0; i < 100; i++) {
			out.push({
				id: i,
				x: Math.random() * 100,
				delay: Math.random() * 0.5,
				duration: 2 + Math.random() * 2,
				size: 6 + Math.random() * 8,
				color: COLORS[Math.floor(Math.random() * COLORS.length)],
				rotation: Math.random() * 360,
			});
		}
		return out;
	}, []);

	useEffect(() => {
		const timer = setTimeout(onComplete, 4500);
		return () => clearTimeout(timer);
	}, [onComplete]);

	return (
		<div className="confetti-overlay">
			{particles.map((p) => (
				<div
					key={p.id}
					className="confetti-particle"
					style={{
						left: `${p.x}%`,
						width: p.size,
						height: p.size * 0.6,
						background: p.color,
						animationDelay: `${p.delay}s`,
						animationDuration: `${p.duration}s`,
						transform: `rotate(${p.rotation}deg)`,
					}}
				/>
			))}
		</div>
	);
}
