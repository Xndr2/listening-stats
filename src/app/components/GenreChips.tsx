interface GenreChipsProps {
	genres: string[] | undefined;
	max?: number;
}

export function GenreChips({ genres, max = 3 }: GenreChipsProps) {
	if (!genres || genres.length === 0) return null;
	const visible = genres.slice(0, max);
	return (
		<div className="genre-chips">
			{visible.map((genre) => (
				<span key={genre} className="genre-chip">
					{genre}
				</span>
			))}
		</div>
	);
}
