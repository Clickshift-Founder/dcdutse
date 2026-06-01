import { useState } from "react";
import { CHURCH } from "../data/church.config.js";

// Renders the church logo from /public/church-logo.png.
// If the image is missing, falls back to a ✝️ placeholder so the
// app never looks broken before the real logo is added.
export default function Logo({ className, size }) {
  const [failed, setFailed] = useState(false);
  const style = size ? { width: size, height: size } : undefined;

  if (failed) {
    return <div className={className} style={style}>✝️</div>;
  }
  return (
    <div className={className} style={style}>
      <img src={CHURCH.logo} alt={CHURCH.name} onError={() => setFailed(true)} />
    </div>
  );
}
