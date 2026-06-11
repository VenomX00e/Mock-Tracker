import { v2 as cloudinary } from "cloudinary";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const env = require("dotenv").config().parsed;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function main() {
  const result = await cloudinary.uploader.destroy("some_random_id", { resource_type: "image" });
  console.log("Result:", result);
}
main();
