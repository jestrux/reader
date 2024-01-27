import {
	addDoc,
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

const fromColor = "#8BC34A";
const toColor = "#4CAF50";

function isValidHttpUrl(string) {
	let url;

	try {
		url = new URL(string);
	} catch (_) {
		return false;
	}

	return url.protocol === "http:" || url.protocol === "https:";
}

async function readClipboardText() {
	const manualRead = () =>
		new Promise((resolve, reject) => {
			const textArea = document.createElement("textarea");
			// textArea.value = text;
			textArea.style.top = "0";
			textArea.style.left = "0";
			textArea.style.position = "fixed";

			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();

			try {
				const successful = document.execCommand("paste");

				if (successful) resolve(textArea.value);
				else reject("Failed to paste");
			} catch (err) {
				reject(err);
			}

			document.body.removeChild(textArea);
		});

	try {
		try {
			return await navigator.clipboard.readText();
		} catch (error) {
			return await manualRead();
		}
	} catch (error) {
		console.log("Error copying text: ", error);
		throw "Failed to copy!";
	}
}

async function processUrl(url) {
	var res = await fetch(
		"https://us-central1-letterplace-c103c.cloudfunctions.net/crawl/" +
			encodeURIComponent(url)
	).then((res) => res.text());
	var div = document.createElement("div");
	div.innerHTML = res;

	const ogImage = div
		.querySelector(`[property="og:image"]`)
		?.getAttribute("content");

	let shortCutIcon = div
		.querySelector(`[rel="shortcut icon"]`)
		?.getAttribute("href");

	if (shortCutIcon && shortCutIcon.toString().charAt(0) == "/") {
		let baseUrl = new URL(url).href;
		if (baseUrl.endsWith("/"))
			baseUrl = baseUrl.substring(0, baseUrl.length - 1);
		shortCutIcon = baseUrl + "/" + shortCutIcon.substring(1);
	}

	const appleTouchIcon = div
		.querySelector(`[rel="apple-touch-icon"]`)
		?.getAttribute("href");

	const twitterImage = div
		.querySelector(`[name="twitter:image"]`)
		?.getAttribute("content");

	const title = div.querySelector(`title`)?.textContent;
	const ogTitle = div
		.querySelector(`[property="og:title"]`)
		?.getAttribute("content");
	const twitterTitle = div
		.querySelector(`[name="twitter:title"]`)
		?.getAttribute("content");

	const description = div
		.querySelector(`[property="description"]`)
		?.getAttribute("content");

	const ogDescription = div
		.querySelector(`[property="og:description"]`)
		?.getAttribute("content");

	const twitterDescription = div
		.querySelector(`[name="twitter:description"]`)
		?.getAttribute("content");

	return {
		url,
		image:
			[
				...new Set(
					[
						twitterImage,
						ogImage,
						appleTouchIcon,
						shortCutIcon,
					].filter((v) => v)
				),
			]?.[0] ?? null,
		title:
			[
				...new Set([twitterTitle, ogTitle, title].filter((v) => v)),
			]?.[0] ?? null,
		description:
			[
				...new Set(
					[twitterDescription, ogDescription, description].filter(
						(v) => v
					)
				),
			]?.[0] ?? null,
	};
}

function App() {
	const randomId = () => Math.random().toString(36).substring(7);
	const [entries, setEntries] = useState(null);
	const [cacheKey, setCacheKey] = useState(randomId());
	const [groupFilter, setGroupFilter] = useState("");
	const groups = ["🌎 General", "📺 Watch", "🧪 Learn", "🎧 Listen"];
	const {
		error,
		isPending: loading,
		mutateAsync,
	} = useMutation({
		mutationKey: ["collections", cacheKey, setCacheKey],
		mutationFn: () => {
			var params = [
				collection(db, "reader"),
				...(groupFilter
					? [where("group", "==", groupFilter), orderBy("group")]
					: []),
				orderBy("index", "desc"),
			];

			return getDocs(query(...params));
		},
	});

	// const {
	// 	isPending: loading,
	// 	error,
	// 	data: value,
	// 	refetch,
	// } = useQuery({
	// 	queryKey: ["collections", cacheKey, setCacheKey],
	// 	queryFn: () => {
	// 		var params = [
	// 			collection(db, "reader"),
	// 			...(groupFilter
	// 				? [where("group", "==", groupFilter), orderBy("group")]
	// 				: []),
	// 			orderBy("index", "desc"),
	// 		];

	// 		return getDocs(query(...params));
	// 	},
	// });

	useEffect(() => {
		if (!entries) refreshData();

		document.addEventListener("focus", refreshData, false);

		const cancelSnapshotListener = onSnapshot(
			collection(db, "reader"),
			() => refreshData()
		);

		return () => {
			document.removeEventListener("focus", refreshData);
			cancelSnapshotListener();
		};
	}, []);

	const refreshData = async () => {
		var res = await mutateAsync();
		setEntries(res.docs);
		setCacheKey(randomId());
	};

	async function handleAdd() {
		try {
			var url = await readClipboardText();
			if (!isValidHttpUrl(url)) throw "Invalid url";

			var entry = await processUrl(url);
			console.log("New entry: ", entry);
			await addDoc(collection(db, "reader"), {
				...(entry ?? {}),
				index: entries.length ?? 1,
				group: groupFilter ?? "🌎 General",
				createdAt: new Date(),
			});
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
		<div
			className="min-h-screen bg-canvas text-content relative"
			style={
				{
					// background: `linear-gradient(-45deg, ${fromColor}, ${toColor})`,
				}
			}
		>
			<button
				className="fixed inset-x-0 mx-auto z-10 shadow-md bg-white dark:bg-[#3c3c3c] border border-transparent dark:border-content/20 h-12 w-32 flex items-center justify-center gap-2 rounded-full px-3.5 focus:outline-none"
				onClick={handleAdd}
				style={{
					bottom: onElectron ? "1.2rem" : "2.8rem",
				}}
			>
				<svg className="h-4 mb-px" viewBox="0 0 24 24">
					<defs>
						<linearGradient
							id="grad1"
							x1="0%"
							y1="0%"
							x2="100%"
							y2="0%"
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
						stroke="url(#grad1)"
						strokeWidth="4"
						strokeLinecap="round"
					/>
				</svg>
				<span
					className="mr-0.5 text-base/none tracking-wide font-bold uppercase"
					style={{
						background: `linear-gradient(-45deg, ${fromColor}, ${toColor})`,
						WebkitBackgroundClip: "text",
						color: "transparent",
					}}
				>
					Add
				</span>
			</button>

			<div className="max-w-4xl mx-auto pb-24">
				<div className="p-4 sticky border-b top-0 bg-card z-20 w-full overflow-x-auto">
					<div className="flex items-center gap-2">
						<button
							className={`${
								!groupFilter && "bg-content/10"
							} focus:outline-none appearance-none rounded-lg border border-content/5 inline-flex items-center justify-center h-6 px-2 text-center text-[10px] uppercase tracking-wider`}
							onClick={() => {
								setGroupFilter("");
								refreshData();
							}}
						>
							All
						</button>
						{groups.map((group) => (
							<button
								key={group}
								className={`${
									groupFilter == group && "bg-content/10"
								} focus:outline-none appearance-none rounded-lg border border-content/5 inline-flex items-center justify-center h-6 px-2 text-center text-[10px] uppercase tracking-wider`}
								onClick={() => {
									setGroupFilter(group);
									refreshData();
								}}
							>
								{group}
							</button>
						))}
					</div>
				</div>

				<div className="p-4">
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
							className="flex flex-col gap-2"
							items={entries}
							onChange={setState}
						>
							{({ item: doc }) => {
								var data = doc.data();

								return (
									<div
										key={doc.id}
										className="group relative w-full text-left bg-card rounded-md p-2 lg:p-4 border border-stroke shadow-sm flex items-center gap-3 lg:gap-6 focus:outline-none"
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
												className="mb-1 relative self-start"
												title="Change group"
											>
												<select
													className="focus:outline-none appearance-none rounded-lg bg-content/10 inline-flex items-center justify-center h-6 px-2 text-center text-[10px] uppercase tracking-wider"
													defaultValue={data.group}
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
											className="cursor-pointer absolute right-2 top-2 size-8 focus:outline-none flex items-center justify-center opacity-0 group-hover:opacity-70 hover:opacity-100"
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
