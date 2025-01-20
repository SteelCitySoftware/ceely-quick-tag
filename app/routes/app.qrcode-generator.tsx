import React, { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Page,
  Layout,
  TextField,
  Card,
  Button,
  Select,
  BlockStack,
} from "@shopify/polaris";

const QRCodeGenerator: React.FC = () => {
  const [tags, setTags] = useState<string>("");
  const [urlPrefix, setUrlPrefix] = useState<string>("");
  const [generatedTags, setGeneratedTags] = useState<string[]>([]);
  const [qrCodesPerRow, setQrCodesPerRow] = useState<number>(3);
  const [fontSize, setFontSize] = useState<number>(12);
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
        printWindow.document.write(`
          <html>
          <head>
            <title>QR Codes</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                text-align: center;
              }
              .qr-code-grid {
                display: grid;
                grid-template-columns: repeat(${qrCodesPerRow}, 1fr);
                gap: 20px;
                width: 100%;
              }
              .qr-code-item {
                text-align: center;
              }
              .qr-code-item p {
                margin-top: 10px;
                font-size: ${fontSize}px;
              }
            </style>
          </head>
          <body>
            ${printRef.current.innerHTML}
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      }
    }
  };

  return (
    <Page title="QR Code Generator">
      <Layout>
        {/* Input Section */}
        <Layout.Section>
          <Card sectioned>
            <BlockStack>
              <TextField
                label="URL Prefix"
                value={urlPrefix}
                onChange={(value) => setUrlPrefix(value)}
                placeholder="https://example.com/"
              />
              <TextField
                label="Tags (one per line)"
                value={tags}
                onChange={(value) => setTags(value)}
                placeholder="Enter tags, one per line"
                multiline
              />
              <Select
                label="QR Codes Per Row"
                options={Array.from({ length: 10 }, (_, i) => ({
                  label: `${i + 1}`,
                  value: i + 1,
                }))}
                value={qrCodesPerRow}
                onChange={(value) => setQrCodesPerRow(Number(value))}
              />
              <Select
                label="Font Size"
                options={Array.from({ length: 25 }, (_, i) => ({
                  label: `${i + 6}px`,
                  value: i + 6,
                }))}
                value={fontSize}
                onChange={(value) => setFontSize(Number(value))}
              />
              <Button primary onClick={handleGenerate}>
                Generate QR Codes
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* QR Code Display Section */}
        {generatedTags.length > 0 && (
          <Layout.Section>
            <Card sectioned>
              <BlockStack>
                <Button onClick={handlePrint} primary>
                  Print QR Codes
                </Button>
                <div
                  ref={printRef}
                  style={{
                    marginTop: "30px",
                  }}
                >
                  <div
                    className="qr-code-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${qrCodesPerRow}, minmax(0, 1fr))`,
                      gap: "20px",
                      width: "100%",
                    }}
                  >
                    {generatedTags.map((tag, index) => (
                      <div
                        className="qr-code-item"
                        key={index}
                        style={{
                          textAlign: "center",
                        }}
                      >
                        <a
                          href={`${urlPrefix}${tag}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <QRCodeSVG
                            value={`${urlPrefix}${tag}`}
                            size={Math.min(100, 1000 / qrCodesPerRow - 40)} // Dynamically adjust size
                          />
                        </a>
                        <p style={{ fontSize: `${fontSize}px` }}>{tag}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
};

export default QRCodeGenerator;
