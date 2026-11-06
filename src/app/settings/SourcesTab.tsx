import { useId, useState } from "react";
import { connectLastFm, connectStatsFm, disconnect } from "../../shared/providers/connections";
import { readLastFmConfig } from "../../shared/providers/lastfm/client";
import { isConnected, PROVIDERS } from "../../shared/providers/registry";
import { readStatsFmConfig } from "../../shared/providers/statsfm/client";
import type { ProviderId } from "../../shared/settings/registry";
import { describeError } from "../components/Widget/Widget";
import { useApp } from "../state";
import { Row, Section, TextField } from "./controls";

function UseButton({ id }: { id: ProviderId }) {
	const { providerId, setProvider } = useApp();
	if (providerId === id) return <span className="ls-pill-on">In use</span>;
	return (
		<button type="button" className="ls-btn-secondary" disabled={!isConnected(id)} onClick={() => setProvider(id)}>
			Use this
		</button>
	);
}

function StatsFm() {
	const cfg = readStatsFmConfig();
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
	const id = useId();
	const connect = async () => {
		setBusy(true);
		setMsg(null);
		try {
			const who = await connectStatsFm(name);
			setMsg({ ok: true, text: `Connected as ${who}.` });
			setName("");
		} catch (e) {
			setMsg({ ok: false, text: describeError(e) });
		} finally {
			setBusy(false);
		}
	};
	return (
		<Section
			title="stats.fm"
			description="Uses your public stats.fm profile. Plus accounts also get play counts per track. Nothing is sent to stats.fm except your username."
		>
			{cfg ? (
				<Row
					label={`Connected as ${cfg.username}`}
					hint={cfg.isPlus ? "Plus account" : "Free account: play counts per item aren't available"}
					control={
						<div className="ls-set-buttons">
							<UseButton id="statsfm" />
							<button type="button" className="ls-btn-secondary" onClick={() => disconnect("statsfm")}>
								Disconnect
							</button>
						</div>
					}
				/>
			) : (
				<form
					className="ls-set-form"
					onSubmit={(e) => {
						e.preventDefault();
						void connect();
					}}
				>
					<label htmlFor={id} className="ls-set-label">
						stats.fm username
					</label>
					<div className="ls-set-inline">
						<TextField
							id={id}
							value={name}
							onChange={setName}
							placeholder="your-name or stats.fm/your-name"
							invalid={msg?.ok === false}
						/>
						<button type="submit" className="ls-btn-primary" disabled={busy || !name.trim()}>
							{busy ? "Checking…" : "Connect"}
						</button>
					</div>
				</form>
			)}
			{msg && <p className={`ls-set-msg ${msg.ok ? "is-ok" : "is-err"}`}>{msg.text}</p>}
		</Section>
	);
}

function LastFm() {
	const cfg = readLastFmConfig();
	const [name, setName] = useState("");
	const [key, setKey] = useState("");
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
	const userId = useId();
	const keyId = useId();
	const connect = async () => {
		setBusy(true);
		setMsg(null);
		try {
			const who = await connectLastFm(name, key);
			setMsg({ ok: true, text: `Connected as ${who}.` });
			setName("");
			setKey("");
		} catch (e) {
			setMsg({ ok: false, text: describeError(e) });
		} finally {
			setBusy(false);
		}
	};
	return (
		<Section
			title="Last.fm"
			description={
				<>
					Needs your username and your own API key (free, from{" "}
					<a href="https://www.last.fm/api/account/create" target="_blank" rel="noreferrer noopener">
						last.fm/api
					</a>
					). Last.fm doesn't track listening time, so it ranks by plays only.
				</>
			}
		>
			{cfg ? (
				<Row
					label={`Connected as ${cfg.username}`}
					control={
						<div className="ls-set-buttons">
							<UseButton id="lastfm" />
							<button type="button" className="ls-btn-secondary" onClick={() => disconnect("lastfm")}>
								Disconnect
							</button>
						</div>
					}
				/>
			) : (
				<form
					className="ls-set-form"
					onSubmit={(e) => {
						e.preventDefault();
						void connect();
					}}
				>
					<label htmlFor={userId} className="ls-set-label">
						Last.fm username
					</label>
					<TextField id={userId} value={name} onChange={setName} invalid={msg?.ok === false} />
					<label htmlFor={keyId} className="ls-set-label">
						API key
					</label>
					<div className="ls-set-inline">
						<TextField id={keyId} value={key} onChange={setKey} type="password" invalid={msg?.ok === false} />
						<button type="submit" className="ls-btn-primary" disabled={busy || !name.trim() || !key.trim()}>
							{busy ? "Checking…" : "Connect"}
						</button>
					</div>
				</form>
			)}
			{msg && <p className={`ls-set-msg ${msg.ok ? "is-ok" : "is-err"}`}>{msg.text}</p>}
		</Section>
	);
}

export function SourcesTab() {
	return (
		<>
			<Section
				title="On this device"
				description="Listening Stats records what you play on this computer. Nothing leaves your device. It works offline and needs no account."
			>
				<Row label={PROVIDERS.local.name} hint="Always available" control={<UseButton id="local" />} />
			</Section>
			<StatsFm />
			<LastFm />
		</>
	);
}
