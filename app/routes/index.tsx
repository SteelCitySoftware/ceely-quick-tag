import { Link } from "@remix-run/react";
import TagVerified from "../routes/tag-verified";
import TagSearch from "../routes/actions/tag-search";

const Index: React.FC = () => {
  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Welcome to the App</h1>
      <p>Click the button below to navigate to the QR Code Generator page:</p>
      <Link
        to="/qrcode-generator"
        style={{
          padding: "10px 20px",
          backgroundColor: "#007bff",
          color: "#fff",
          textDecoration: "none",
          borderRadius: "5px",
        }}
      >
        Go to QR Code Generator
      </Link>
    </div>
  );
};

export { TagVerified, TagSearch };

export default Index;
