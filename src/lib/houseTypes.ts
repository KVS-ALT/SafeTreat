import type { Candy } from "./allergens";

export type MyHouse = {
  id: string; displayName: string; legalName: string; address: string; lat: number; lng: number;
  candies: Candy[]; allergenFree: string[]; nonFoodTreats: boolean; hoursStart: string; hoursEnd: string; active: boolean;
  verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "FAILED"; verificationNote: string | null;
  verifiedName: string | null; addressMatchesId: boolean; verifiedAt: string | null; safetyFlag: string;
  idDocumentType: string | null;
};
export type NearbyReport = { id: string; title: string; aiSummary: string; createdAt: string };
