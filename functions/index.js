import * as functions from "firebase-functions";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import parse from "node-html-parser";

// eslint-disable-next-line no-unused-vars
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

const app = express();
app.use(cors({ origin: "*" }));
app.get("/:url", async (req, res) => {
	const url = req.params.url;
	const response = await fetch(url);
	const content = await response.text();
	// processWebsite(url, content);

	res.status(200).send(content);
});

export const crawl = functions.https.onRequest(app);
