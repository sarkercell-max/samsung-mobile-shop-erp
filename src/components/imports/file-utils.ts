import * as XLSX from "xlsx";

export type ParsedSheet = { columns: string[]; rows: Record<string, string>[] };

export async function parseImportFile(file: File): Promise<ParsedSheet> {
  if (file.size > 5 * 1024 * 1024) throw new Error("File is too large. Maximum size is 5 MB.");
  if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error("Choose a .csv or .xlsx file.");
  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, { type: "array", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  if (!sheet) throw new Error("The file does not contain a worksheet.");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
  const columns = (matrix[0] ?? []).map((v, i) => String(v ?? "").trim() || `Column ${i + 1}`);
  if (!columns.length) throw new Error("The first worksheet has no header row.");
  const rows = matrix.slice(1).map((values) => Object.fromEntries(columns.map((column, i) => [column, String(values?.[i] ?? "").trim()]))).filter((row) => Object.values(row).some(Boolean));
  if (rows.length > 5000) throw new Error("Maximum file size is 5,000 data rows.");
  if (!rows.length) throw new Error("No data rows were found below the header.");
  return { columns, rows };
}

export function downloadRows(rows: Record<string, unknown>[], filename: string, format: "csv" | "xlsx") {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(book, sheet, "Data");
  XLSX.writeFile(book, `${filename}.${format}`, { bookType: format });
}
