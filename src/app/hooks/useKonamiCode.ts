const { useEffect, useRef } = Spicetify.React;

const KONAMI = [
	"ArrowUp",
	"ArrowUp",
	"ArrowDown",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"ArrowLeft",
	"ArrowRight",
	"b",
	"a",
];

export function useKonamiCode(onActivate: () => void): void {
	const idxRef = useRef(0);
	const timerRef = useRef<ReturnType<typeof setTimeout>>();

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const expected = KONAMI[idxRef.current];
			if (e.key.toLowerCase() !== expected.toLowerCase()) {
				idxRef.current = 0;
				return;
			}
			idxRef.current++;
			clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				idxRef.current = 0;
			}, 2000);

			if (idxRef.current === KONAMI.length) {
				idxRef.current = 0;
				onActivate();
			}
		};
		window.addEventListener("keydown", handler);
		return () => {
			window.removeEventListener("keydown", handler);
			clearTimeout(timerRef.current);
		};
	}, [onActivate]);
}
