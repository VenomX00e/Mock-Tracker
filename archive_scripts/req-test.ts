import fetch from "node-fetch";
async function run() {
  const response = await fetch("http://localhost:3000/api/extract-scorecard", {
    method: "POST",
    headers: {
      "Authorization": "Bearer test",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ images: [] })
  });
  const json = await response.json().catch(e => null);
  const text = await response.text().catch(e => null);
  console.log("Status:", response.status);
  console.log("JSON:", json);
  console.log("TEXT:", text);
}
run();
