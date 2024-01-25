import {
	addDoc,
	collection,
	doc,
	getDocs,
	orderBy,
	query,
	setDoc,
} from "firebase/firestore";
import { db } from "./firebaseApp";
import { useQuery } from "@tanstack/react-query";
import DragDropList from "./DragDropList";
import { useEffect, useState } from "react";

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
		image: [
			...new Set(
				[twitterImage, ogImage, appleTouchIcon, shortCutIcon].filter(
					(v) => v
				)
			),
		]?.[0],
		title: [
			...new Set([twitterTitle, ogTitle, title].filter((v) => v)),
		]?.[0],
		description: [
			...new Set(
				[twitterDescription, ogDescription, description].filter(
					(v) => v
				)
			),
		]?.[0],
	};
}

function App() {
	const randomId = () => Math.random().toString(36).substring(7);
	const [cacheKey, setCacheKey] = useState(randomId());

	const {
		isPending: loading,
		error,
		data: value,
		refetch,
	} = useQuery({
		queryKey: ["collections", cacheKey, setCacheKey],
		queryFn: () =>
			getDocs(query(collection(db, "reader"), orderBy("index", "asc"))),
	});

	useEffect(() => {
		document.addEventListener("focus", refreshData, false);
		return () => document.removeEventListener("focus", refreshData);
	}, []);

	const refreshData = async () => {
		await refetch();
		setCacheKey(randomId());
	};

	async function handleAdd() {
		try {
			var url = await readClipboardText();
			if (!isValidHttpUrl(url)) throw "Invalid url";

			var entry = await processUrl(url);
			// console.log("New entry: ", entry);
			await addDoc(collection(db, "reader"), {
				...(entry ?? {}),
				index: value?.docs.length ?? 1,
				group: "🌎 General",
				// group: "👓 general",
				createdAt: new Date(),
			});

			refreshData();
		} catch (error) {
			alert(error);
		}
	}

	function setState(data) {
		data.forEach((entry, newIndex) => {
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

	return (
		<div
			className="min-h-screen bg-canvas text-content"
			style={
				{
					// background: `linear-gradient(-45deg, ${fromColor}, ${toColor})`,
				}
			}
		>
			<button
				className="fixed inset-x-0 mx-auto bottom-12 shadow-md bg-card border border-stroke h-12 w-32 flex items-center justify-center gap-2 rounded-full px-3.5 focus:outline-none"
				onClick={handleAdd}
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

			<div className="p-3 lg:p-6 max-w-4xl mx-auto">
				<div className="text-center">
					{error && <strong>Error: {JSON.stringify(error)}</strong>}
					{!value && loading && <span>Collection: Loading...</span>}
				</div>

				{value && (
					<DragDropList
						key={cacheKey}
						className="flex flex-col gap-2 divide-y divide-stroke"
						items={value.docs}
						onChange={setState}
					>
						{({ item: doc }) => {
							var data = doc.data();

							return (
								<button
									key={doc.id}
									className="w-full text-left bg-card rounded-md p-2 lg:p-4 border border-stroke shadow-sm flex items-center gap-3 lg:gap-6 focus:outline-none"
								>
									<div className="flex-shrink-0 h-20 w-24 bg-content/5 rounded relative flex items-center justify-center">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
											strokeWidth={1.5}
											stroke="currentColor"
											className="w-6 h-6"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"
											/>
										</svg>

										{data.image && (
											<img
												src={data.image}
												alt=""
												className="absolute inset-0 size-full rounded bg-card"
												onError={(e) =>
													(e.target.style.opacity = 0)
												}
											/>
										)}
									</div>

									<div className="flex flex-col">
										<label className="mb-px relative">
											<select
												className="focus:outline-none"
												defaultValue={data.group}
												onChange={(e) =>
													setGroup(
														doc.id,
														e.target.value
													)
												}
											>
												<option>🌎 General</option>
												<option>📺 Watch</option>
												<option>🧪 Learn</option>
											</select>
										</label>
										<h3 className="font-medium truncate">
											{data.title}
										</h3>
										<p className="text-sm/relaxed opacity-50 truncate">
											{data.description}
										</p>
									</div>
								</button>
							);
						}}
					</DragDropList>
				)}
			</div>
		</div>
	);
}

export default App;
