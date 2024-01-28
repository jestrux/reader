import admin from "firebase-admin";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("./admin.json"));

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
});

export const db = admin.firestore();
