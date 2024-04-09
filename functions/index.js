import * as functions from "firebase-functions";
import * as admin from "./admin.js";

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { parse } from "node-html-parser";

function processWebsite(url, content) {
	const div = parse(content);

	const ogImage = div
		.querySelector(`[property="og:image"]`)
		?.getAttribute("content");

	let shortCutIcon = div
		.querySelector(`[rel="shortcut icon"]`)
		?.getAttribute("href");

	if (shortCutIcon && shortCutIcon.toString().charAt(0) == "/") {
		let baseUrl = new URL(url).href;
		if (baseUrl.endsWith("/")) {
			baseUrl = baseUrl.substring(0, baseUrl.length - 1);
		}
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

const app = express();

app.use(cors({ origin: "*" }));

app.get("/crawl/:url", async (req, res) => {
	const response = await fetch(req.params.url);
	const data = await response.text();
	const meta = processWebsite(req.params.url, data);

	res.status(200).json({ success: true, url: req.params.url, data, meta });
});

app.post("/crawl", async (req, res) => {
	const url = req.body.url;
	const response = await fetch(url);
	const content = await response.text();
	const entry = processWebsite(url, content);

	const collectionRef = admin.db.collection("reader");
	const entries = (await collectionRef.get()).docs;

	try {
		const payload = {
			...(entry ?? {}),
			index: (entries?.length ?? 0) + 1,
			group: req.body.group ?? "🌎 General",
			createdAt: new Date(),
		};

		await collectionRef.doc().create(payload);

		res.status(200).json({ ...payload, success: true });
	} catch (error) {
		res.status(500).json({ success: false, error });
	}
});

app.post("/mailer", async (req, res) => {
	try {
		const payload = {
			to: req.body.to,
			message: req.body.message,
		};

		await admin.db.collection("__email").doc().create(payload);

		res.status(200).json({ ...payload, success: true });
	} catch (error) {
		res.status(500).json({ success: false, error });
	}
});

export const api = functions.https.onRequest(app);
