import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extractFacturaFromUrl } from "../src/lib/extractFacturaFromUrl";

async function main() {
  const [input, output, strategyArg, methodArg] = process.argv.slice(2);

  if (!input || !output) {
    console.error("Uso: tsx scripts/extractToFile.ts <ruta_o_url> <salida.json> [estrategia(1|2)] [metodo]");
    process.exit(1);
  }

  try {
    const strategy = strategyArg === "1" || strategyArg === "2" ? (Number(strategyArg) as 1 | 2) : undefined;
    const method = methodArg ?? (strategy ? "auto" : strategyArg ?? "auto");

    let data;
    if (strategy) {
      data = await extractFacturaFromUrl(input, strategy, method as any);
    } else if (strategyArg) {
      data = await extractFacturaFromUrl(input, strategyArg as any);
    } else {
      data = await extractFacturaFromUrl(input, method as any);
    }

    const target = resolve(output);
    await writeFile(target, JSON.stringify(data, null, 2), "utf8");
    console.log(`Extracción completada. JSON guardado en: ${target}`);
  } catch (error) {
    console.error("Error durante la extracción:", error);
    process.exit(1);
  }
}

main();
