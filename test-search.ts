import dotenv from "dotenv";
dotenv.config();

console.log("Tavily:", !!process.env.TAVILY_API_KEY);
console.log("Exa:", !!process.env.EXA_API_KEY);
console.log("Tinyfish:", !!process.env.TINYFISH_API_KEY);
