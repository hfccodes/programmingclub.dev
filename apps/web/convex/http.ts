import { httpRouter } from "convex/server";
import { callback } from "./discord";

const http = httpRouter();

// Discord's OAuth redirect for verification (the developer app lists this URL for the dev and prod deployments).
http.route({ path: "/discord/callback", method: "GET", handler: callback });

export default http;
