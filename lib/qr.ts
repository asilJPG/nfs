import "server-only";
import QRCode from "qrcode";

// SVG, чтобы табличку можно было печатать любого размера без внешних запросов
export async function qrSvg(text: string, size = 240): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#1b1410", light: "#ffffff" },
  });
}
