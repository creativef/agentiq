import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

interface FileItem {
  id: string;
  companyId: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  createdAt: string;
}

export default function FileHub() {
  const { company } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const fetchFiles = useCallback(() => {
    if (!company) return;
    const url = `/api/files?companyId=${company.id}`;
    fetch(url, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => setFiles(d?.files || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [company]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const handleUpload = async (file: File) => {
    if (!company || !file) return;
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("companyId", company.id);
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (res.ok) {
        fetchFiles();
      } else {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        setUploadError(err.error || "Upload failed");
      }
    } catch (err: any) {
      setUploadError(err.message || "Network error during upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      await handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleUpload(e.target.files[0]);
    }
  };

  const handleDownload = (f: FileItem) => {
    const link = document.createElement("a");
    link.href = `/api/files/${f.id}/download`;
    link.download = f.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm("Delete this file?")) return;
    await fetch(`/api/files/${fileId}`, { method: "DELETE", credentials: "include" });
    fetchFiles();
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  const fileIcon = (type: string) => {
    if (type.startsWith("image/")) return "🖼️";
    if (type === "application/pdf") return "📄";
    if (type.startsWith("text/")) return "📋";
    if (type.includes("spreadsheet") || type.includes("excel")) return "📊";
    return "📁";
  };

  // Drag and drop event listeners
  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (!dropZone.contains(e.relatedTarget as Node)) {
        setDragOver(false);
      }
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleDropOuter = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
    };

    dropZone.addEventListener("dragenter", handleDragEnter);
    dropZone.addEventListener("dragleave", handleDragLeave);
    dropZone.addEventListener("dragover", handleDragOver);
    dropZone.addEventListener("drop", handleDropOuter);

    return () => {
      dropZone.removeEventListener("dragenter", handleDragEnter);
      dropZone.removeEventListener("dragleave", handleDragLeave);
      dropZone.removeEventListener("dragover", handleDragOver);
      dropZone.removeEventListener("drop", handleDropOuter);
    };
  }, []);

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  return (
    <div ref={dropZoneRef} style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Files</h1>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{ padding: "8px 16px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: uploading ? "wait" : "pointer" }}
        >
          {uploading ? "⬆️ Uploading..." : "⬆️ Upload"}
        </button>
      </div>

      {/* Upload Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? "#3b82f6" : "#4B5563"}`,
          borderRadius: "8px",
          padding: "2rem",
          textAlign: "center",
          marginBottom: "1.5rem",
          background: dragOver ? "#1e3a5f" : "#1f2937",
          transition: "all 0.2s ease",
        }}
      >
        <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📂</div>
        <div style={{ color: "#9ca3af", marginBottom: "0.5rem" }}>
          Drag & drop files here to upload
        </div>
        <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
          or click the Upload button above
        </div>
      </div>

      {uploadError && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: "6px", color: "#fca5a5" }}>
          {uploadError}
        </div>
      )}

      {files.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <p>No files yet. Upload your first file!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1f2937", textAlign: "left" }}>
                <th style={{ padding: "12px", borderBottom: "1px solid #374151" }}>File</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #374151" }}>Size</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #374151" }}>Date</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #374151", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map(f => (
                <tr key={f.id} style={{ borderBottom: "1px solid #1f2937" }}>
                  <td style={{ padding: "12px" }}>
                    <span style={{ marginRight: "8px" }}>{fileIcon(f.fileType)}</span>
                    {f.fileName}
                  </td>
                  <td style={{ padding: "12px", color: "#9ca3af" }}>{formatSize(f.fileSize)}</td>
                  <td style={{ padding: "12px", color: "#9ca3af" }}>{new Date(f.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => handleDownload(f)}
                        style={{ padding: "2px 8px", background: "#1e3a5f", border: "none", color: "#60a5fa", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}
                      >
                        ⬇️ Download
                      </button>
                      <button
                        onClick={() => handleDelete(f.id)}
                        style={{ padding: "2px 8px", background: "#450a0a", border: "none", color: "#f87171", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
