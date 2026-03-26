import Exa from "exa-js";

if (!process.env.EXA_API_KEY) {
  console.warn("[EXA] EXA_API_KEY not set — benchmark fetch will be skipped");
}

export const exaClient = process.env.EXA_API_KEY
  ? new Exa(process.env.EXA_API_KEY)
  : null;
