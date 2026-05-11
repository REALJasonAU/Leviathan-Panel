import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { config } from "../config.js";

const privateKey = config.FIREBASE_PRIVATE_KEY?.replaceAll("\\n", "\n");

export const firebaseEnabled = Boolean(
  config.FIREBASE_PROJECT_ID &&
  config.FIREBASE_CLIENT_EMAIL &&
  privateKey &&
  !config.MOCK_DATA,
);

const app =
  getApps()[0] ??
  (firebaseEnabled
    ? initializeApp({
        credential: cert({
          projectId: config.FIREBASE_PROJECT_ID,
          clientEmail: config.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
        storageBucket: config.FIREBASE_STORAGE_BUCKET,
      })
    : initializeApp({
        credential: applicationDefault(),
      }));

export const firebaseAuth = getAuth(app);
export const firestore = getFirestore(app);
