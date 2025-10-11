import { extractFacturaFromUrl } from "../src/lib/extractFacturaFromUrl";

async function main() {
  const fileUrl =
    process.argv[2] ??
    "https://raw.githubusercontent.com/mozilla/pdf.js/master/test/pdfs/helloworld.pdf";

  try {
    const result = await extractFacturaFromUrl(fileUrl, "auto");
    console.log("Extracción completada:");
    console.dir(result, { depth: null });
  } catch (error) {
    console.error("Error durante la extracción:");
    console.error(error);
    process.exitCode = 1;
  }
}

main();

