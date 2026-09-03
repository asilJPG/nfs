import "server-only";
import QRCode from "qrcode";

/**
 * Inline SVG, so the tent card prints crisply at any size and needs no request
 * to an image host from inside the dashboard.
 */
export async function qrSvg(text: string, size = 240): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#1b1410", light: "#ffffff" },
  });
}
