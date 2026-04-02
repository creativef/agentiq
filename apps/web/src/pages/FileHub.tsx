import { useState, useEffect } from "react";

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  createdAt: string;
}

export default function FileHub() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/files", { credentials: "include" })
      .then(r => r.ok ? r.json() : { files: [] })
      .then(d => setFiles(d.files || []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    await fetch("/api/files", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    window.location.reload();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  const fileIcon = (type: string) => {
    if (type.startsWith("image/")) return "\uD83D\uDDBC\uFE0F";
    if (type === "application/pdf") return "\uD83D\uDCC4";
    if (type.startsWith("text/")) return "\uD83D\uDCCB";
    return "\uD83D\uDCC1";
  };

  if (loading) return <div style={{ padding: "2rem", color: "#888" }}>Loading...</div>;

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>File Hub</h1>
        <label style={{ padding: "8px 16px", background: "#3b82f6", border: "none", color: "white", borderRadius: "4px", cursor: "pointer" }}>
          \u2B06\uFE0F Upload
          <input type="file" onChange={handleUpload} style={{ display: "none" }} />
        </label>
      </div>

      {files.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>\uD83D\uDCC1</div>
          <p>No files yet. Click &quot;Upload&quot; to add files.</p>
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#1f2937", textAlign: "left" }}>
              <th style={{ padding: "12px", borderBottom: "1px solid #374151" }}>File</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #374151" }}>Size</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #374151" }}>Type</th>
              <th style={{ padding: "12px", borderBottom: "1px solid #374151" }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {files.map(f => (
              <tr key={f.id} style={{ borderBottom: "1px solid #1f2937" }}>
                <td style={{ padding: "12px" }}>
                  <span style={{ marginRight: "8px" }}>{fileIcon(f.type)}</span>
                  {f.name}
                </td>
                <td style={{ padding: "12px", color: "#9ca3af" }}>{formatSize(f.size)}</td>
                <td style={{ padding: "12px", color: "#9ca3af" }}>{f.type || "unknown"}</td>
                <td style={{ padding: "12px", color: "#9ca3af" }}>{new Date(f.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
