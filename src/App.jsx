import {
	collection,
	deleteDoc,
	doc,
	getDocs,
	onSnapshot,
	orderBy,
	query,
	setDoc,
	where,
} from "firebase/firestore";
import { db } from "./firebaseApp";
import { useMutation } from "@tanstack/react-query";
import DragDropList from "./DragDropList";
import { useEffect, useState } from "react";
import Loader from "./Loader";
import { Clipboard } from "@capacitor/clipboard";
import { SendIntent } from "send-intent";
import { Toast } from "@capacitor/toast";
import { Preferences } from "@capacitor/preferences";
import { App as CapacitorApp } from "@capacitor/app";

// const fromColor = "#8BC34A";
// const fromColor = "#2196F3";
// const toColor = "#4CAF50";

const fromColor = "#d3ffff";
const toColor = "#f2ddb0";

function isValidHttpUrl(string) {
	let url;

	try {
		url = new URL(string);
	} catch (_) {
		return false;
	}

	return url.protocol === "http:" || url.protocol === "https:";
}

async function showToast(message) {
	try {
		await Toast.show({
			text: message,
		});
	} catch (error) {
		/* empty */
	}
}

async function readClipboardText() {
	try {
		const { value } = await Clipboard.read();
		return value;
	} catch (error) {
		console.log("Error copying text: ", error);
		throw "Failed to copy!";
	}
}

const getGroupFilter = async () =>
	(await Preferences.get({ key: "groupFilter" })).value ?? "";

const NewEntry = ({ __id, url, group, onSave }) => {
	const {
		// error,
		// isPending: loading,
		mutateAsync: saveEntry,
	} = useMutation({
		mutationKey: ["add-entry"],
		mutationFn: async (data) => {
			const res = await fetch(
				"https://us-central1-letterplace-c103c.cloudfunctions.net/api/crawl",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(data),
				}
			).then((res) => res.json());

			if (!res?.success) throw res.error ?? "Failed to add, try again";

			// alert(JSON.stringify(res));

			showToast(`${res?.title || "Entry"} Added `);

			onSave(__id);
		},
	});

	useEffect(() => {
		try {
			saveEntry({ url, group: group ?? "🌎 General" });
		} catch (error) {
			onSave(__id);
			alert(error);
		}
	}, []);

	const onElectron = document.body.classList.contains("on-electron");

	return (
		<div className={`pb-2 ${onElectron ? "group" : "lg:group"}`}>
			<div className="relative w-full text-left bg-card rounded-md p-2 lg:p-4 border border-stroke shadow-sm flex items-center gap-3 lg:gap-6 focus:outline-none">
				<div className="flex-shrink-0 h-20 w-24 bg-content/5 rounded relative flex items-center justify-center">
					<Loader color="currentColor" size={40} thickness={3.5} />
				</div>

				<div className="flex flex-col">
					<label className="relative self-start" title="Change group">
						<select
							className="focus:outline-none appearance-none bg-transparent rounded-lg inline-flex items-center justify-center text-[10px] font-bold uppercase tracking-wider"
							defaultValue={group}
						>
							<option>{group}</option>
						</select>
					</label>
					<h3 className="font-medium truncate">{url}</h3>
					<p className="text-sm/relaxed opacity-50 truncate">
						Saving new entry...
					</p>
				</div>
			</div>
		</div>
	);
};

function App() {
	const randomId = () => Math.random().toString(36).substring(7);
	const [newEntries, setNewEntries] = useState([]);
	const [entries, setEntries] = useState(null);
	const [cacheKey, setCacheKey] = useState(randomId());
	const [groupFilter, _setGroupFilter] = useState("");

	const setGroupFilter = async (value) => {
		_setGroupFilter(value);

		try {
			await Preferences.set({
				key: "groupFilter",
				value,
			});
		} catch (error) {
			/* empty */
		}

		refreshData();
	};
	const groups = ["📺 Watch", "🧪 Learn", "🎧 Listen", "🌎 General"];
	const {
		error,
		isPending: loading,
		mutateAsync: fetchEntries,
	} = useMutation({
		mutationKey: ["collections", cacheKey, setCacheKey],
		mutationFn: async (groupFilter) => {
			var params = [
				collection(db, "reader"),
				...(groupFilter
					? [where("group", "==", groupFilter), orderBy("group")]
					: []),
				orderBy("index", "desc"),
			];

			var res = await getDocs(query(...params));
			return res.docs;
		},
	});

	const listenForOpen = () => {
		CapacitorApp.addListener("appUrlOpen", (event) => {
			// showToast(JSON.stringify(new URL(event.url)));
			try {
				const slug = event.url.split("reader://app").pop();
				const url = new URL(event.url);

				if (slug && url.pathname?.length) {
					const params = url.searchParams;
					const id = params.get("id") || params.get("_id");
					const [start] = params.get("crop").split(",");

					Clipboard.write({
						// string: `https://www.youtube.com/watch?v=${id}&t=${start}s`,
						string: event.url,
					});

					window.open(
						`https://www.youtube.com/watch?v=${id}&t=${start}s`,
						"_blank"
					);

					// alert(
					// 	`App: ${url.pathname}: Params: ` +
					// 		JSON.stringify(
					// 			Object.fromEntries(url.searchParams.entries())
					// 		)
					// );
				} else {
					alert("App: " + event.url);
				}
			} catch (error) {
				alert("Error: " + error);
			}
		});
	};

	const listenForShare = async () => {
		try {
			const result = await SendIntent.checkSendIntentReceived();
			if (result?.title?.length) {
				handleAddEntry({
					url: decodeURIComponent(result.title),
					fromShareSheet: true,
				});
			}
		} catch (error) {
			// alert("Share process failed: ", error);
		}
	};

	useEffect(() => {
		const groupId = groupFilter ?? "All";
		const filterButton = document.querySelector(
			`[data-group-filter="${groupId}"]`
		);
		if (filterButton) filterButton.scrollIntoView();
	}, [groupFilter]);

	useEffect(() => {
		if (!entries) refreshData();

		document.addEventListener("focus", refreshData, false);

		listenForShare();

		listenForOpen();

		window.addEventListener("sendIntentReceived", listenForShare, false);

		const cancelSnapshotListener = onSnapshot(
			collection(db, "reader"),
			() => refreshData()
		);

		return () => {
			document.removeEventListener("focus", refreshData);
			window.removeEventListener(
				"sendIntentReceived",
				listenForShare,
				false
			);
			CapacitorApp.removeAllListeners();
			cancelSnapshotListener();
		};
	}, []);

	const refreshData = async () => {
		const groupFilter = await getGroupFilter();
		_setGroupFilter(groupFilter);
		setEntries(await fetchEntries(groupFilter));
		setCacheKey(randomId());
	};

	async function handleAddEntry({
		url: shareSheetUrl,
		fromShareSheet = false,
	} = {}) {
		try {
			const url = fromShareSheet
				? shareSheetUrl
				: await readClipboardText();

			if (!isValidHttpUrl(url)) throw "Invalid url";

			setNewEntries([
				...newEntries,
				{
					__id: randomId(),
					url,
					group: (await getGroupFilter()) || "🌎 General",
				},
			]);
		} catch (error) {
			alert(error);
		}
	}

	function setState(data) {
		data.forEach((entry, idx) => {
			const newIndex = entries.length - idx;
			const { index } = entry.data() || {};
			if (index != newIndex) {
				console.log("Data: ", entry.id, index, newIndex);
				setDoc(
					doc(db, "reader", entry.id),
					{ index: newIndex },
					{ merge: true }
				).then((res) => console.log("Doc set: ", res));
			}
		});
	}

	async function setGroup(docId, group) {
		setDoc(doc(db, "reader", docId), { group }, { merge: true });
	}

	async function removeEntry(e, docId) {
		e.stopPropagation();

		if (!(await confirm("Are you sure?"))) return;

		await deleteDoc(doc(db, "reader", docId));
	}

	const onElectron = document.body.classList.contains("on-electron");

	return (
		<div className="min-h-screen bg-canvas text-content relative">
			<style>
				{
					/*css*/ `
						:root {
							--gradient-bg: linear-gradient(45deg, ${fromColor}, ${toColor});
							--gradient-bg-text: #3E3215;
						}
					`
				}
			</style>

			<button
				id="fab"
				className="fixed inset-x-0 mx-auto z-10 shadow border border-content/5 dark:border-content/20 h-12 w-32 flex items-center justify-center gap-2 rounded-full px-3.5 focus:outline-none"
				onClick={handleAddEntry}
				style={{
					bottom: onElectron ? "1.2rem" : "2.8rem",
				}}
			>
				<svg className="h-4 mb-px" viewBox="0 0 24 24">
					<defs>
						<linearGradient
							id="gradientMask"
							x1="0%"
							y1="0%"
							x2="100%"
							y2="100%"
						>
							<stop
								offset="0%"
								style={{
									stopColor: fromColor,
									stopOpacity: 1,
								}}
							/>
							<stop
								offset="100%"
								style={{
									stopColor: toColor,
									stopOpacity: 1,
								}}
							/>
						</linearGradient>
					</defs>

					<path
						d="M12 4.5v15m7.5-7.5h-15"
						fill="none"
						strokeWidth="3.5"
						strokeLinecap="round"
					/>
				</svg>
				<span className="mr-0.5 text-base/none tracking-wide font-semibold uppercase">
					Add
				</span>
			</button>

			<div className="pb-24">
				<div
					id="appBar"
					className={`sticky shadow-sm border-b top-0 z-20 w-screen overflow-auto`}
				>
					<div
						className="px-4 max-w-4xl mx-auto flex items-center gap-2"
						style={{
							marginTop: "env(safe-area-inset-top)",
							height: "60px",
						}}
					>
						<button
							data-group-filter="All"
							className={`${
								!groupFilter
									? "bg-white border-white/20 text-[--appbar-color] dark:bg-white/10 dark:border-white/10 dark:text-white"
									: "opacity-70 border-transparent"
							} flex-shrink-0 focus:outline-none rounded-lg border inline-flex items-center justify-center h-8 px-2.5 text-center text-xs uppercase font-bold`}
							onClick={() => setGroupFilter("")}
						>
							All
						</button>
						{groups.map((group) => (
							<button
								key={group}
								data-group-filter={group}
								className={`${
									groupFilter == group
										? "bg-white border-white/20 text-[--appbar-color] dark:bg-white/10 dark:border-white/10 dark:text-white"
										: "opacity-70 border-transparent"
								} flex-shrink-0 focus:outline-none rounded-lg border inline-flex items-center justify-center h-8 px-2.5 text-center text-xs uppercase font-bold`}
								style={{ wordSpacing: "0.25rem" }}
								onClick={() => setGroupFilter(group)}
							>
								{group}
							</button>
						))}

						<span>&nbsp;</span>
					</div>
				</div>

				<div className="max-w-4xl mx-auto p-4">
					{newEntries.map((entry, index) => (
						<div
							key={index}
							style={{
								display:
									!groupFilter?.length ||
									entry.group == groupFilter
										? ""
										: "none",
							}}
						>
							<NewEntry
								{...entry}
								onSave={(__id) =>
									setNewEntries((newEntries) =>
										newEntries.filter((e) => e.__id != __id)
									)
								}
							/>
						</div>
					))}

					<div className="text-center">
						{error && (
							<strong>Error: {JSON.stringify(error)}</strong>
						)}
						{!entries && loading && (
							<div className="py-4 flex justify-center text-content/20">
								<Loader
									color="currentColor"
									size={60}
									thickness={3.5}
								/>
							</div>
						)}
					</div>

					{entries && (
						<DragDropList
							key={cacheKey}
							items={entries}
							onChange={setState}
						>
							{({ item: doc }) => {
								var data = doc.data();

								return (
									<div
										key={doc.id}
										className={`pb-2 ${
											onElectron ? "group" : "lg:group"
										}`}
									>
										<div
											className="relative w-full text-left bg-card rounded-md p-2 lg:p-4 border border-stroke shadow-sm flex items-center gap-3 lg:gap-6 focus:outline-none"
											onClick={() => {
												onElectron
													? window.dispatchEvent(
															new CustomEvent(
																"open-url",
																{
																	detail: data.url,
																}
															)
													  )
													: window.open(
															data.url,
															"_blank"
													  );
											}}
										>
											<div className="flex-shrink-0 h-20 w-24 bg-content/5 rounded relative flex items-center justify-center">
												<svg
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
													strokeWidth={1.5}
													stroke="currentColor"
													className="size-8 opacity-50"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
													/>
												</svg>

												{data.image && (
													<img
														src={data.image}
														alt=""
														className="absolute inset-0 size-full object-cover rounded bg-card"
														onError={(e) =>
															(e.target.style.opacity = 0)
														}
													/>
												)}
											</div>

											<div className="flex flex-col">
												<label
													className="relative self-start"
													title="Change group"
												>
													<select
														className="focus:outline-none appearance-none bg-transparent inline-flex items-center text-[10px] font-bold uppercase tracking-wider"
														defaultValue={
															data.group
														}
														onClick={(e) =>
															e.stopPropagation()
														}
														onChange={(e) =>
															setGroup(
																doc.id,
																e.target.value
															)
														}
													>
														{groups.map((group) => (
															<option key={group}>
																{group}
															</option>
														))}
													</select>
												</label>
												<h3 className="font-medium truncate">
													{data.title}
												</h3>
												<p className="text-sm/relaxed opacity-50 truncate">
													{data.description}
												</p>
											</div>

											<label
												title="Remove"
												className="cursor-pointer absolute right-2 top-2 size-8 focus:outline-none flex items-center justify-center opacity-0 group-hover:opacity-70"
												onClick={(e) =>
													removeEntry(e, doc.id)
												}
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
													strokeWidth={1.5}
													stroke="currentColor"
													className="size-5"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M6 18 18 6M6 6l12 12"
													/>
												</svg>
											</label>
										</div>
									</div>
								);
							}}
						</DragDropList>
					)}
				</div>
			</div>
		</div>
	);
}

export default App;
