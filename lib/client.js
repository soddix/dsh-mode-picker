window.__ModuleLoader__.load({
	id: "dsh-mode-picker",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");

		const STYLE_TAG_ID = "dsh-mode-picker/mode-picker.css";
		const DIAG_URL = "/dsh-mode-picker/diag";

		const CSS = [
			'.mop-dock{width:100%;box-sizing:border-box;padding:12px;border-radius:16px;background:rgba(127,127,127,.10);border:1px solid rgba(127,127,127,.32);font-family:inherit;color:inherit}',
			'.mop-head{margin:0 0 10px;font-size:12px;letter-spacing:.06em;opacity:.72}',
			'.mop-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(146px,1fr));gap:8px}',
			'.mop-btn{display:block;width:100%;box-sizing:border-box;text-align:left;padding:9px 11px;border-radius:10px;border:1px solid rgba(127,127,127,.34);background:rgba(127,127,127,.12);color:inherit;font:inherit;font-size:13px;line-height:1.35;cursor:pointer}',
			'.mop-btn:hover:not(:disabled){background:rgba(127,127,127,.24);border-color:rgba(127,127,127,.58)}',
			'.mop-btn:disabled{opacity:.45;cursor:default}',
			'.mop-name{display:block;font-weight:600}',
			'.mop-desc{display:block;margin-top:2px;font-size:11.5px;opacity:.68}',
			'.mop-tag{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:999px;font-size:10px;background:rgba(59,130,246,.22);border:1px solid rgba(59,130,246,.45)}',
			'.mop-note{margin:9px 0 0;font-size:11.5px;opacity:.62}',
			'.mop-err{margin:9px 0 0;font-size:12px;color:#e5484d}',
			'.mop-idle{box-sizing:border-box;padding:8px 12px;border-radius:12px;background:rgba(127,127,127,.08);border:1px dashed rgba(127,127,127,.34);font-family:inherit;font-size:12px;opacity:.72;word-break:break-word}',
			'.mop-chip{display:inline-flex;align-items:center;gap:7px;box-sizing:border-box;max-width:100%;padding:4px 10px;border-radius:999px;border:1px solid rgba(127,127,127,.38);background:rgba(127,127,127,.12);color:inherit;font:inherit;font-size:12.5px;cursor:pointer}',
			'.mop-chip:hover{background:rgba(127,127,127,.24);border-color:rgba(127,127,127,.6)}',
			'.mop-chip-k{opacity:.62}',
			'.mop-chip-v{font-weight:600}',
			'.mop-chip-x{opacity:.62}',
			'.mop-foot{display:flex;justify-content:flex-end;margin-top:10px}',
			'.mop-link{padding:3px 9px;border-radius:8px;border:1px solid rgba(127,127,127,.34);background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer;opacity:.8}',
			'.mop-link:hover{opacity:1;background:rgba(127,127,127,.18)}'
		].join("");

		/** Install the plugin stylesheet; the disposer removes the tag on unload. */
		function installStyles() {
			if (typeof document === "undefined") return () => {};
			let tag = document.querySelector('style[data-plugin-css=' + JSON.stringify(STYLE_TAG_ID) + ']');
			if (tag === null) {
				tag = document.createElement("style");
				tag.dataset.plugin = "dsh-mode-picker";
				tag.dataset.pluginCss = STYLE_TAG_ID;
				document.head.appendChild(tag);
			}
			tag.textContent = CSS;
			return () => {
				if (tag.parentNode !== null) tag.parentNode.removeChild(tag);
			};
		}

		/** Read a guarded service without letting a refusal escape as a crash. */
		function safeRead(read) {
			try {
				return read();
			} catch (ignored) {
				return undefined;
			}
		}

		/** Ship one diagnostic payload to the host sink; never surface a failure. */
		function report(payload) {
			try {
				if (typeof fetch !== "function") return;
				fetch(DIAG_URL, {
					method: "POST",
					headers: { "content-type": "text/plain" },
					body: JSON.stringify(payload)
				}).catch(() => {});
			} catch (ignored) {
				/* diagnostics must never break the feature */
			}
		}

		/** Unwrap a Remote result, tolerating both `{value}` envelopes and bare payloads. */
		function unwrap(result) {
			if (result !== null && typeof result === "object" && "value" in result) return result.value;
			return result;
		}

		/**
		 * Reduce the roster to the leaves this UI renders. The Remote roster is
		 * live host data, so nothing but scalars is carried across.
		 */
		function toRows(roster) {
			const presets =
				roster !== null && typeof roster === "object" && Array.isArray(roster.presets) ? roster.presets : [];
			return presets.map((row) => ({
				id: String(row.id),
				name: row.name === undefined ? "" : String(row.name),
				description: row.description === undefined ? "" : String(row.description),
				broken: row.broken === undefined ? "" : String(row.broken)
			}));
		}

		function describeFailure(cause) {
			if (cause === null || cause === undefined) return "未知错误";
			if (typeof cause === "string") return cause;
			if (typeof cause.message === "string" && cause.message !== "") return cause.message;
			return String(cause);
		}

		/**
		 * A failed render must stay visible. Without this boundary a thrown
		 * component is swallowed by the slot renderer and the seat goes blank,
		 * which hides the very error that explains the failure.
		 */
		class Boundary extends React.Component {
			constructor(props) {
				super(props);
				this.state = { message: "" };
			}
			static getDerivedStateFromError(error) {
				return { message: describeFailure(error) };
			}
			componentDidCatch(error) {
				report({ event: "render-threw", message: describeFailure(error) });
				try {
					console.error("[dsh-mode-picker] render failed", error);
				} catch (ignored) {
					/* logging must never escalate a render failure */
				}
			}
			render() {
				if (this.state.message !== "") {
					return React.createElement("div", { className: "mop-idle" }, "模式选择器渲染失败：" + this.state.message);
				}
				return this.props.children;
			}
		}

		// Two injection tiers, matching the shipped agent-preset UI: a dotted Remote
		// key resolves only as a plugin-level hard dependency, while the
		// session-scoped `conversation` service resolves through a scoped injection.
		const inject = ["slots", "remote.agentPresets"];

		function apply(ctx) {
			ctx.effect(() => installStyles());

			const slots = safeRead(() => ctx.slots);
			if (slots === undefined) {
				report({ event: "no-slots" });
				return;
			}

			let presets = safeRead(() => ctx.remote.agentPresets);
			let attempts = 0;
			const probes = [];

			/**
			 * Resolve the Remote namespace across every access shape this runtime
			 * offers, recording which one answered. The namespace is populated when
			 * the browser connection completes, so the first read inside `apply` can
			 * legitimately come back empty; the retry pump below covers that window.
			 */
			function resolvePresets() {
				if (presets !== undefined) return presets;
				const candidates = [
					["ctx.remote.agentPresets", () => ctx.remote.agentPresets],
					['ctx.get("remote.agentPresets")', () => ctx.get("remote.agentPresets")],
					['ctx.get("remote").agentPresets', () => ctx.get("remote").agentPresets]
				];
				for (const entry of candidates) {
					const value = safeRead(entry[1]);
					if (probes.length < 12) probes.push(entry[0] + "=" + (value === undefined ? "undefined" : "ok"));
					if (value !== undefined) {
						presets = value;
						report({ event: "remote-bound", via: entry[0], attempts });
						return presets;
					}
				}
				return presets;
			}

			// The composer lock is optional: without it the picker still lists and
			// switches modes, so a missing conversation service must not block apply.
			let conversation;
			const watchers = new Set();
			const publish = () => {
				for (const notify of Array.from(watchers)) {
					try {
						notify();
					} catch (ignored) {
						/* a broken watcher must not abort the others */
					}
				}
			};
			ctx.inject(["conversation"], (scope) => {
				const bound = safeRead(() => scope.conversation);
				if (bound === undefined) return;
				conversation = bound;
				publish();
			});

			/** Bounded retry: the connection namespace can land after this plugin applies. */
			function pump() {
				resolvePresets();
				if (presets !== undefined || attempts >= 30) return;
				attempts += 1;
				if (typeof window === "undefined") return;
				window.setTimeout(() => {
					if (resolvePresets() !== undefined) publish();
					pump();
				}, 500);
			}
			resolvePresets();
			pump();

			/**
			 * The new-session mode picker.
			 *
			 * Occupies `conversation.hero.agentPreset`, the seat the new-session
			 * screen renders, and owns its own roster and selection the way that seat
			 * requires. It finds the current session the way the shipped control does
			 * (`useSessions` → `state.current` / `state.byId`), because this seat is
			 * root-scoped and receives no `sessionId` prop.
			 */
			function ModePicker(props) {
				const [, forceUpdate] = React.useReducer((n) => n + 1, 0);
				React.useEffect(() => {
					watchers.add(forceUpdate);
					return () => {
						watchers.delete(forceUpdate);
					};
				}, []);

				const service = resolvePresets();
				const readSessions = props.useSessions;
				const hasReader = typeof readSessions === "function";
				const currentId = hasReader ? readSessions((state) => state.current) : undefined;
				const isBlank = hasReader
					? readSessions((state) => {
						const row = state.current === undefined ? undefined : state.byId[state.current];
						return row !== undefined && row !== null && row.blank === true;
					})
					: undefined;
				const recorded = hasReader
					? readSessions((state) => {
						const row = state.current === undefined ? undefined : state.byId[state.current];
						const values = row === undefined || row === null ? undefined : row.projectionValues;
						const value = values === undefined || values === null ? undefined : values.agentPreset;
						return typeof value === "string" ? value : "";
					})
					: "";

				const [roster, setRoster] = React.useState(null);
				const [error, setError] = React.useState("");
				const [busy, setBusy] = React.useState(false);
				const [picked, setPicked] = React.useState("");
				const [open, setOpen] = React.useState(true);
				const activeId = picked !== "" ? picked : recorded;
				const live = currentId !== undefined;
				const showing = live && open === true && isBlank === true;

				const lastReport = React.useRef("");
				React.useEffect(() => {
					const payload = {
						event: "render",
						attempts,
						bound: service !== undefined,
						probes: probes.slice(-6),
						useSessions: hasReader ? "function" : typeof readSessions,
						currentId: live ? String(currentId) : null,
						isBlank: isBlank === true ? true : isBlank === undefined ? "undefined" : false,
						recorded,
						roster: roster === null ? null : roster.length,
						showing,
						lock: conversation !== undefined,
						error
					};
					const key = JSON.stringify(payload);
					if (key === lastReport.current) return;
					lastReport.current = key;
					report(payload);
				});

				React.useEffect(() => {
					if (service === undefined) return undefined;
					let alive = true;
					Promise.resolve(service.list())
						.then((result) => {
							if (!alive) return;
							setRoster(toRows(unwrap(result)));
						})
						.catch((cause) => {
							if (alive) setError("读取模式列表失败：" + describeFailure(cause));
						});
					return () => {
						alive = false;
					};
				}, [service]);

				// While the grid is open on a still-blank session the composer is locked
				// through the official per-session block registry, so the choice cannot
				// be skipped; collapsing or picking clears it again.
				React.useEffect(() => {
					if (!showing) return undefined;
					if (conversation === undefined || conversation.blocks === undefined) return undefined;
					conversation.blocks.set(currentId, { reason: "选择一个模式开始这个会话" });
					return () => {
						conversation.blocks.set(currentId, undefined);
					};
				}, [showing, currentId]);

				if (service === undefined) {
					return React.createElement(
						"div",
						{ className: "mop-idle" },
						"模式选择器拿不到模式列表接口。探测：" + (probes.length === 0 ? "（无）" : probes.join(" / "))
					);
				}
				if (!live) {
					return React.createElement("div", { className: "mop-idle" }, "模式选择器已加载：等待一个新会话");
				}

				const labelOf = (id) => {
					if (id === "") return "部署默认";
					if (roster === null) return id;
					const hit = roster.find((one) => one.id === id);
					if (hit === undefined) return id;
					return hit.name === "" ? hit.id : hit.name;
				};

				if (showing !== true) {
					return React.createElement(
						"button",
						{ type: "button", className: "mop-chip", title: "点击重新选择模式", onClick: () => setOpen(true) },
						React.createElement("span", { className: "mop-chip-k" }, "模式"),
						React.createElement("span", { className: "mop-chip-v" }, labelOf(activeId)),
						React.createElement("span", { className: "mop-chip-x" }, "切换")
					);
				}

				const pick = (presetId) => {
					if (busy) return;
					setBusy(true);
					setError("");
					Promise.resolve(service.select(String(currentId), String(presetId)))
						.then(() => {
							setPicked(presetId);
							setBusy(false);
							setOpen(false);
						})
						.catch((cause) => {
							setBusy(false);
							setError(describeFailure(cause));
						});
				};

				const children = [
					React.createElement(
						"p",
						{ className: "mop-head", key: "head" },
						activeId === "" ? "为这个新会话选择一个模式" : "切换模式（当前：" + labelOf(activeId) + "）"
					)
				];
				if (roster === null) {
					children.push(
						React.createElement("p", { className: "mop-note", key: "note" }, error === "" ? "正在读取模式列表…" : error)
					);
				} else {
					children.push(
						React.createElement(
							"div",
							{ className: "mop-grid", key: "grid" },
							roster.map((preset) =>
								React.createElement(
									"button",
									{
										key: preset.id,
										type: "button",
										className: "mop-btn",
										disabled: busy === true || preset.broken !== "",
										title: preset.broken !== "" ? preset.broken : preset.description === "" ? preset.id : preset.description,
										onClick: () => pick(preset.id)
									},
									React.createElement(
										"span",
										{ className: "mop-name" },
										preset.name === "" ? preset.id : preset.name,
										preset.id === activeId ? React.createElement("span", { className: "mop-tag" }, "当前") : null
									),
									preset.description === "" ? null : React.createElement("span", { className: "mop-desc" }, preset.description)
								)
							)
						)
					);
					if (error !== "") children.push(React.createElement("p", { className: "mop-err", key: "err" }, error));
					if (activeId !== "")
						children.push(
							React.createElement(
								"div",
								{ className: "mop-foot", key: "foot" },
								React.createElement("button", { type: "button", className: "mop-link", onClick: () => setOpen(false) }, "保留当前模式，收起")
							)
						);
				}

				return React.createElement("div", { className: "mop-dock" }, children);
			}

			function Guarded(props) {
				return React.createElement(Boundary, null, React.createElement(ModePicker, props));
			}

			slots.inject("conversation.hero.agentPreset", () =>
				slots.register({ name: "conversation.hero.agentPreset" }, Guarded)
			);
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
