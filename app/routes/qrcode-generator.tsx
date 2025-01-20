import React, { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

const QRCodeGenerator: React.FC = () => {
  const [tags, setTags] = useState<string>("");
  const [urlPrefix, setUrlPrefix] = useState<string>("");
  const [generatedTags, setGeneratedTags] = useState<string[]>([]);
  const [qrCodesPerRow, setQrCodesPerRow] = useState<number>(3);
  const printRef = useRef<HTMLDivElement>(null);

  const handleGenerate = () => {
    const tagList = tags
      .split("\n")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    setGeneratedTags(tagList);
  };

  const handlePrint = () => {
    if (printRef.current) {
      const printWindow = window.open("", "PRINT", "height=600,width=800");
      if (printWindow) {
        printWindow.document.write("<html><head><title>QR Codes</title>");
        printWindow.document.write(
          "<style>body { font-family: Arial, sans-serif; text-align: center; } .qr-code-grid { display: grid; grid-template-columns: repeat(" +
            qrCodesPerRow +
            ", 1fr); gap: 20px; } .qr-code-item { text-align: center; } .qr-code-item p { margin: 0 auto; width: fit-content; text-align: center; overflow: visible; white-space: normal; }</style>",
        );
        printWindow.document.write("</head><body>");
        printWindow.document.write(printRef.current.outerHTML);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      }
    }
  };

  const qrCodeSize = Math.floor(1000 / qrCodesPerRow) - 20; // Adjust size based on number of columns

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>QR Code Generator</h1>

      <div style={{ marginBottom: "20px" }}>
        <label htmlFor="urlPrefix">URL Prefix:</label>
        <br />
        <input
          id="urlPrefix"
          type="text"
          value={urlPrefix}
          onChange={(e) => setUrlPrefix(e.target.value)}
          placeholder="https://example.com/"
          style={{ width: "100%", padding: "10px", marginTop: "5px" }}
        />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label htmlFor="tags">Tags (one per line):</label>
        <br />
        <textarea
          id="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Enter tags, one per line"
          rows={10}
          style={{ width: "100%", padding: "10px", marginTop: "5px" }}
        />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label htmlFor="qrCodesPerRow">QR Codes Per Row:</label>
        <br />
        <select
          id="qrCodesPerRow"
          value={qrCodesPerRow}
          onChange={(e) => setQrCodesPerRow(Number(e.target.value))}
          style={{ width: "100%", padding: "10px", marginTop: "5px" }}
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
            <option key={num} value={num}>
              {num}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleGenerate}
        style={{
          padding: "10px 20px",
          backgroundColor: "#007bff",
          color: "#fff",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          marginRight: "10px",
        }}
      >
        Generate QR Codes
      </button>

      {generatedTags.length > 0 && (
        <>
          <button
            onClick={handlePrint}
            style={{
              padding: "10px 20px",
              backgroundColor: "#28a745",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              marginTop: "20px",
            }}
          >
            Print QR Codes
          </button>

          <div ref={printRef} style={{ marginTop: "30px" }}>
            <h2>Generated QR Codes</h2>
            <div
              className="qr-code-grid"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${qrCodesPerRow}, 1fr)`,
                gap: "20px",
              }}
            >
              {generatedTags.map((tag, index) => (
                <div
                  className="qr-code-item"
                  key={index}
                  style={{ textAlign: "center" }}
                >
                  <a
                    href={`${urlPrefix}${tag}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <QRCodeSVG value={`${urlPrefix}${tag}`} size={qrCodeSize} />
                  </a>
                  <p
                    style={{
                      marginTop: "10px",
                      width: "fit-content",
                      margin: "0 auto",
                      textAlign: "center",
                    }}
                  >
                    {tag}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default QRCodeGenerator;
