import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Plus, Search, Users, MapPin, Download, Heart, Building2, Archive, ArchiveRestore, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Newspaper, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "./dashboard";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Child, Organization } from "@shared/schema";

const EXPORT_FIELDS = [
  { key: "childId", label: "Child ID" },
  { key: "fullName", label: "Full Name" },
  { key: "age", label: "Age" },
  { key: "gender", label: "Gender" },
  { key: "location", label: "Location" },
  { key: "programEnrollment", label: "Program Enrollment" },
  { key: "assignedSponsors", label: "Assigned Sponsors" },
  { key: "assignedCaseWorker", label: "Case Worker" },
  { key: "status", label: "Status" },
  { key: "isSponsored", label: "Sponsored" },
] as const;


function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [selectedFields, setSelectedFields] = useState<string[]>(EXPORT_FIELDS.map((f) => f.key));
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const toggleField = (key: string) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  const handleExport = async () => {
    if (selectedFields.length === 0) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/export/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fields: selectedFields, format }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `children-export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export complete", description: `Downloaded as ${format.toUpperCase()}` });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Export failed", description: error.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Children Data</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Select Fields</Label>
            <div className="grid grid-cols-2 gap-3">
              {EXPORT_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`export-${field.key}`}
                    checked={selectedFields.includes(field.key)}
                    onCheckedChange={() => toggleField(field.key)}
                    data-testid={`checkbox-export-${field.key}`}
                  />
                  <Label htmlFor={`export-${field.key}`} className="text-sm cursor-pointer">{field.label}</Label>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Format</Label>
            <div className="flex gap-2">
              <Button
                variant={format === "csv" ? "default" : "outline"}
                size="sm"
                className="rounded-lg toggle-elevate"
                onClick={() => setFormat("csv")}
                data-testid="button-format-csv"
              >
                CSV
              </Button>
              <Button
                variant={format === "xlsx" ? "default" : "outline"}
                size="sm"
                className="rounded-lg toggle-elevate"
                onClick={() => setFormat("xlsx")}
                data-testid="button-format-xlsx"
              >
                XLSX
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" className="rounded-lg" onClick={() => onOpenChange(false)} data-testid="button-cancel-export">Cancel</Button>
            <Button className="rounded-lg shadow-sm" onClick={handleExport} disabled={downloading || selectedFields.length === 0} data-testid="button-download-export">
              {downloading ? "Exporting..." : "Download"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Column mapping from template headers → internal field keys
// ---------------------------------------------------------------------------
const HEADER_MAP: Record<string, string> = {
  "full name": "fullName",
  "child id": "childId",
  "date of birth (yyyy-mm-dd)": "dateOfBirth",
  "gender (male/female)": "gender",
  "status (active/paused/exited)": "status",
  "location (dale/shanto/boricha/addis ababa/hawassa/gillo bisare)": "location",
  "location": "location",
  "is sponsored (yes/no)": "isSponsored",
  "assigned case worker": "assignedCaseWorker",
  "program enrollment": "programEnrollment",
  "description": "description",
  "age": "age",
  "assigned sponsors": "assignedSponsors",
};

interface ParsedRow {
  [key: string]: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setRows([]);
    setFileName("");
    setParseError("");
    setResult(null);
    setDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const parseFile = async (file: File) => {
    setParseError("");
    setRows([]);
    setResult(null);
    setFileName(file.name);

    try {
      const XLSX = (await import("xlsx")).default ?? await import("xlsx");
      const buffer = await file.arrayBuffer();
      // cellDates: true makes XLSX parse date cells into JS Date objects
      // instead of leaving them as Excel serial numbers
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];

      if (raw.length < 2) {
        setParseError("The file appears to be empty or has only a header row.");
        return;
      }

      // Format a JS Date as YYYY-MM-DD (local time)
      const formatDate = (d: Date): string => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };

      // Row 0 = headers, Row 1 = notes (template) or data, Row 2+ = data
      const headerRow = raw[0].map((h: any) => String(h).toLowerCase().trim());
      const fieldKeys = headerRow.map((h: string) => HEADER_MAP[h] || h);

      // Detect if row 1 is a notes/instructions row (starts with "REQUIRED" or "Optional")
      const row1First = String(raw[1]?.[0] || "").trim().toUpperCase();
      const dataStartRow = row1First.startsWith("REQUIRED") || row1First.startsWith("OPTIONAL") ? 2 : 1;

      const parsed: ParsedRow[] = [];
      for (let i = dataStartRow; i < raw.length; i++) {
        const cells = raw[i];
        if (cells.every((c: any) => String(c).trim() === "")) continue; // skip blank rows
        const entry: ParsedRow = {};
        fieldKeys.forEach((key: string, idx: number) => {
          const raw = cells[idx];
          // Excel date cells come through as JS Date objects when cellDates: true
          if (raw instanceof Date && !isNaN(raw.getTime())) {
            entry[key] = formatDate(raw);
          } else {
            entry[key] = String(raw ?? "").trim();
          }
        });
        parsed.push(entry);
      }

      if (parsed.length === 0) {
        setParseError("No data rows found in the file.");
        return;
      }
      setRows(parsed);
    } catch (err: any) {
      setParseError("Could not parse file: " + (err.message || "Unknown error"));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  function calcAgeFromDob(dob: string): number | null {
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return Math.max(0, age);
  }

  function resolvedAge(row: ParsedRow): number | null {
    const fromCol = parseInt(row.age);
    if (!isNaN(fromCol) && fromCol >= 0) return fromCol;
    return calcAgeFromDob(row.dateOfBirth);
  }

  const rowErrors = (row: ParsedRow) => {
    const errs: string[] = [];
    if (!row.fullName) errs.push("Full Name required");
    if (!row.location) errs.push("Location required");
    if (resolvedAge(row) === null) errs.push("Invalid age — provide Date of Birth or Age");
    if (!["male", "female"].includes((row.gender || "").toLowerCase())) errs.push("Gender must be male or female");
    if (!["active", "paused", "exited"].includes((row.status || "").toLowerCase())) errs.push("Status must be active, paused, or exited");
    return errs;
  };

  const validRows = rows.filter((r) => rowErrors(r).length === 0);
  const invalidRows = rows.filter((r) => rowErrors(r).length > 0);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const res = await apiRequest("POST", "/api/children/import", { rows: validRows });
      const data: ImportResult = await res.json();
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      if (data.success > 0) {
        toast({ title: "Import complete", description: `${data.success} child${data.success !== 1 ? "ren" : ""} added successfully.` });
      }
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const previewCols = ["fullName", "age", "gender", "location", "status", "isSponsored"];
  const previewLabels: Record<string, string> = {
    fullName: "Full Name", age: "Age", gender: "Gender", location: "Location", status: "Status", isSponsored: "Sponsored",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Bulk Import Children
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-5">
            {/* Upload area */}
            {rows.length === 0 && (
              <div
                className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                  dragging ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/50 hover:bg-muted/30"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                data-testid="import-drop-zone"
              >
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium mb-1">Drop your Excel or CSV file here</p>
                <p className="text-xs text-muted-foreground">or click to browse — .xlsx, .xls, .csv supported</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                  data-testid="input-import-file"
                />
              </div>
            )}

            {parseError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {parseError}
              </div>
            )}

            {/* Preview table */}
            {rows.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{fileName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rows.length} row{rows.length !== 1 ? "s" : ""} found
                      {invalidRows.length > 0 && (
                        <span className="text-amber-600 ml-1">· {invalidRows.length} with errors (will be skipped)</span>
                      )}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={reset} data-testid="button-import-reset">
                    Change file
                  </Button>
                </div>

                <div className="rounded-lg border border-border/50 overflow-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-8">#</th>
                        {previewCols.map((col) => (
                          <th key={col} className="text-left px-3 py-2 font-medium text-muted-foreground">{previewLabels[col]}</th>
                        ))}
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => {
                        const errs = rowErrors(row);
                        const hasError = errs.length > 0;
                        return (
                          <tr key={i} className={`border-t border-border/30 ${hasError ? "bg-destructive/5" : "hover:bg-muted/20"}`}>
                            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                            {previewCols.map((col) => {
                              let display: string | undefined = row[col];
                              if (col === "age" && (!display || display === "0")) {
                                const computed = resolvedAge(row);
                                display = computed !== null ? String(computed) : undefined;
                              }
                              return (
                                <td key={col} className={`px-3 py-2 ${hasError ? "text-muted-foreground" : ""}`}>
                                  {display || <span className="text-muted-foreground/40 italic">—</span>}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2">
                              {hasError
                                ? <span className="text-destructive">{errs.join("; ")}</span>
                                : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {invalidRows.length > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-xs">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>Rows with errors will be skipped. Fix them in the spreadsheet and re-upload, or proceed to import only the valid rows.</span>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" className="rounded-lg" onClick={() => handleClose(false)} data-testid="button-import-cancel">
                Cancel
              </Button>
              {rows.length > 0 && (
                <Button
                  className="rounded-lg shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleImport}
                  disabled={importing || validRows.length === 0}
                  data-testid="button-import-confirm"
                >
                  {importing ? "Importing..." : `Import ${validRows.length} Child${validRows.length !== 1 ? "ren" : ""}`}
                </Button>
              )}
            </DialogFooter>
          </div>
        ) : (
          /* Result screen */
          <div className="space-y-5">
            <div className={`rounded-lg p-5 border ${result.success > 0 ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-destructive/5 border-destructive/20"}`}>
              <div className="flex items-center gap-3">
                {result.success > 0
                  ? <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
                  : <AlertCircle className="h-8 w-8 text-destructive shrink-0" />
                }
                <div>
                  <p className="font-semibold text-base">
                    {result.success > 0 ? `${result.success} child${result.success !== 1 ? "ren" : ""} imported successfully` : "Import failed"}
                  </p>
                  {result.failed > 0 && (
                    <p className="text-sm text-muted-foreground mt-0.5">{result.failed} row{result.failed !== 1 ? "s" : ""} failed</p>
                  )}
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Errors</p>
                <div className="rounded-lg border border-border/50 divide-y divide-border/30 max-h-48 overflow-auto">
                  {result.errors.map((err, i) => (
                    <div key={i} className="px-3 py-2 text-xs text-destructive">{err}</div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button className="rounded-lg shadow-sm" onClick={() => handleClose(false)} data-testid="button-import-done">
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewsletterDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [targetProgram, setTargetProgram] = useState("__all__");

  const { data: organizations } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/organizations"],
  });

  const reset = () => {
    setTitle("");
    setFile(null);
    setUploading(false);
    setTargetProgram("__all__");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) return;
    setUploading(true);
    try {
      const slotRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!slotRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await slotRes.json();

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error("File upload failed");

      const saveRes = await fetch("/api/newsletters", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectPath,
          fileName: file.name,
          title: title.trim(),
          contentType: file.type,
          fileSize: file.size,
          targetProgram: targetProgram === "__all__" ? null : targetProgram,
        }),
      });
      if (!saveRes.ok) throw new Error("Failed to save newsletter");

      await queryClient.invalidateQueries({ queryKey: ["/api/newsletters"] });
      const programLabel = targetProgram === "__all__" ? "all sponsors" : `sponsors in "${targetProgram}"`;
      toast({ title: "Newsletter uploaded", description: `"${title.trim()}" is now visible to ${programLabel}.` });
      handleClose(false);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-violet-500" />
            Upload Newsletter
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="nl-title" className="text-sm font-medium">Title</Label>
            <Input
              id="nl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Spring 2026 Newsletter"
              className="h-10 rounded-lg border-border/60"
              data-testid="input-newsletter-title"
            />
          </div>

          {/* Program audience selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Send to</Label>
            <div className="grid gap-2">
              {[{ value: "__all__", label: "All Programs", sub: "Every sponsor sees this newsletter" }, ...(organizations ?? []).map(o => ({ value: o.name, label: o.name, sub: `Only sponsors in ${o.name}` }))].map(opt => {
                const active = targetProgram === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTargetProgram(opt.value)}
                    data-testid={`button-nl-program-${opt.value}`}
                    className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                      active
                        ? "border-violet-400 bg-violet-50 dark:bg-violet-500/10 dark:border-violet-500/40"
                        : "border-border/60 hover:border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${active ? "border-violet-500 bg-violet-500" : "border-muted-foreground/30"}`}>
                      {active && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <p className={`text-sm font-medium leading-none ${active ? "text-violet-700 dark:text-violet-300" : ""}`}>{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">File</Label>
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/50 bg-muted/30 p-6 cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              data-testid="drop-zone-newsletter"
            >
              {file ? (
                <div className="flex items-center gap-2 text-sm">
                  <Newspaper className="h-4 w-4 text-violet-500 shrink-0" />
                  <span className="font-medium truncate max-w-[220px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center">Click to select a file <br /><span className="text-xs">PDF, Word, or any document</span></p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} data-testid="input-newsletter-file" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-lg" onClick={() => handleClose(false)}>Cancel</Button>
          <Button
            className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white"
            onClick={handleUpload}
            disabled={uploading || !file || !title.trim()}
            data-testid="button-upload-newsletter"
          >
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ChildrenList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canEdit = user?.role !== "sponsor";
  const isAdmin = user?.role === "admin";
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const initialStatus = urlParams.get("status") || "all";
  const initialSponsored = urlParams.get("sponsored") || "all";

  const [view, setView] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [sponsoredFilter, setSponsoredFilter] = useState(initialSponsored);
  const [orgFilter, setOrgFilter] = useState("all");
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newsletterOpen, setNewsletterOpen] = useState(false);

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch("/api/children/template", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to download template");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "children-import-template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    }
  };

  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  const { data: children, isLoading } = useQuery<Child[]>({
    queryKey: ["/api/children"],
    queryFn: async () => {
      const res = await fetch("/api/children", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch children");
      return res.json();
    },
    enabled: view === "active",
  });

  const { data: archivedChildren, isLoading: archivedLoading } = useQuery<Child[]>({
    queryKey: ["/api/children/archived"],
    queryFn: async () => {
      const res = await fetch("/api/children/archived", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch archived children");
      return res.json();
    },
    enabled: view === "archived" && isAdmin,
  });

  const unarchiveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/children/${id}/unarchive`, {});
      return res.json();
    },
    onSuccess: (child: Child) => {
      queryClient.invalidateQueries({ queryKey: ["/api/children/archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/children"] });
      toast({ title: "Profile restored", description: `${child.fullName} has been restored to active profiles.` });
    },
    onError: (err: Error) => toast({ title: "Restore failed", description: err.message, variant: "destructive" }),
  });

  const selectedOrg = orgFilter !== "all" ? organizations?.find((o) => String(o.id) === orgFilter) : null;

  const filtered = children?.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.fullName.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q) ||
      c.childId.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesSponsored =
      sponsoredFilter === "all" ||
      (sponsoredFilter === "sponsored" && c.isSponsored) ||
      (sponsoredFilter === "non-sponsored" && !c.isSponsored);
    const matchesProgram =
      !selectedOrg ||
      (c as any).organizationId === selectedOrg.id ||
      c.programEnrollment?.toLowerCase() === selectedOrg.name.toLowerCase();
    return matchesSearch && matchesStatus && matchesSponsored && matchesProgram;
  });

  const filteredArchived = archivedChildren?.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q) ||
      c.childId.toLowerCase().includes(q)
    );
  });

  const loading = view === "active" ? isLoading : archivedLoading;

  return (
    <div className="flex-1 overflow-auto p-5 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]" data-testid="text-children-title">Children</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Manage all child profiles and records
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <div className="flex rounded-lg border border-border/60 p-0.5 bg-muted/30">
                <button
                  onClick={() => setView("active")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${view === "active" ? "bg-white dark:bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  data-testid="button-view-active"
                >
                  Active
                </button>
                <button
                  onClick={() => setView("archived")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${view === "archived" ? "bg-white dark:bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  data-testid="button-view-archived"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archived
                  {archivedChildren && archivedChildren.length > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-semibold px-1">
                      {archivedChildren.length}
                    </span>
                  )}
                </button>
              </div>
            )}
            {view === "active" && (
              <>
                <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setExportOpen(true)} data-testid="button-export">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
                {canEdit && (
                  <>
                    <Button variant="outline" size="sm" className="rounded-lg" onClick={handleDownloadTemplate} data-testid="button-download-template">
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Template
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setImportOpen(true)} data-testid="button-import-open">
                      <Upload className="mr-2 h-4 w-4" />
                      Import
                    </Button>
                    {isAdmin && (
                      <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setNewsletterOpen(true)} data-testid="button-newsletter-open">
                        <Newspaper className="mr-2 h-4 w-4" />
                        Newsletter
                      </Button>
                    )}
                    <Button asChild size="sm" className="rounded-lg shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="button-add-child-list">
                      <Link href="/children/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Child
                      </Link>
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={view === "archived" ? "Search archived profiles..." : "Search by name, ID, or location..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-lg border-border/60"
              data-testid="input-search-children"
            />
          </div>
          {view === "active" && (
            <>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px] h-11 rounded-lg border-border/60" data-testid="select-status-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="exited">Exited</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sponsoredFilter} onValueChange={setSponsoredFilter}>
                <SelectTrigger className="w-full sm:w-[180px] h-11 rounded-lg border-border/60" data-testid="select-sponsored-filter">
                  <SelectValue placeholder="All Sponsorship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sponsorship</SelectItem>
                  <SelectItem value="sponsored">Sponsored</SelectItem>
                  <SelectItem value="non-sponsored">Non-Sponsored</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
          {isAdmin && organizations && organizations.length > 0 && (
            <Select value={orgFilter} onValueChange={setOrgFilter}>
              <SelectTrigger className="w-full sm:w-[200px] h-11 rounded-lg border-border/60" data-testid="select-org-filter">
                <SelectValue placeholder="All Programs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Archive notice */}
        {view === "archived" && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50 dark:bg-amber-500/8 dark:border-amber-500/20 px-4 py-3">
            <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Archived profiles are hidden from the active list and preserved indefinitely. Only an admin can permanently delete or restore them.
            </p>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-28 w-full rounded-lg" />
              </Card>
            ))}
          </div>
        ) : view === "active" ? (
          !filtered?.length ? (
            <Card className="flex flex-col items-center justify-center p-16 text-center border-border/50">
              <Users className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="mb-2 text-lg font-semibold">No children found</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {search || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Add your first child to get started"}
              </p>
              {canEdit && !search && statusFilter === "all" && (
                <Button asChild className="rounded-lg shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Link href="/children/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Child
                  </Link>
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {filtered.map((child) => (
                <Link key={child.id} href={`/children/${child.id}`}>
                  <Card className="p-5 cursor-pointer border-border/50 transition-all duration-200 hover:shadow-md hover:border-primary/15 hover:-translate-y-0.5" data-testid={`card-child-list-${child.id}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/8 text-sm font-semibold text-primary">
                        {child.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-start justify-between gap-2">
                          <div className="overflow-hidden">
                            <p className="truncate font-medium">{child.fullName}</p>

                          </div>
                          <StatusBadge status={child.status} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {child.isSponsored ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25 text-xs" data-testid={`badge-sponsored-${child.id}`}>
                          <Heart className="mr-1 h-3 w-3" />
                          Sponsored
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground border-border/60" data-testid={`badge-not-sponsored-${child.id}`}>
                          Not Sponsored
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span>Age {child.age}</span>
                      <span className="capitalize">{child.gender}</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {child.location}
                      </span>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">{child.programEnrollment}</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )
        ) : (
          /* Archived view */
          !filteredArchived?.length ? (
            <Card className="flex flex-col items-center justify-center p-16 text-center border-border/50">
              <Archive className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="mb-2 text-lg font-semibold">No archived profiles</h3>
              <p className="text-sm text-muted-foreground">
                {search ? "No archived profiles match your search." : "Archived child profiles will appear here."}
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {filteredArchived.map((child) => {
                return (
                  <Card key={child.id} className="p-5 border-border/50 opacity-80" data-testid={`card-archived-${child.id}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                        {child.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-start justify-between gap-2">
                          <div className="overflow-hidden">
                            <p className="truncate font-medium">{child.fullName}</p>

                          </div>
                          <StatusBadge status={child.status} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`badge-archived-date-${child.id}`}>
                      <Archive className="h-3 w-3 shrink-0" />
                      Archived {child.archivedAt ? new Date(child.archivedAt as unknown as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>Age {child.age}</span>
                      <span className="capitalize">{child.gender}</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {child.location}
                      </span>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 rounded-lg h-8 text-xs gap-1.5"
                        onClick={() => unarchiveMutation.mutate(child.id)}
                        disabled={unarchiveMutation.isPending}
                        data-testid={`button-restore-${child.id}`}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                        Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 rounded-lg h-8 text-xs text-muted-foreground"
                        asChild
                        data-testid={`button-view-archived-${child.id}`}
                      >
                        <Link href={`/children/${child.id}`}>View Profile</Link>
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        )}
        <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
        <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
        <NewsletterDialog open={newsletterOpen} onOpenChange={setNewsletterOpen} />
      </div>
    </div>
  );
}
