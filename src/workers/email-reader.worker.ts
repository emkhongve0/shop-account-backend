import { google } from "googleapis";
import { convert } from "html-to-text";
import express from "express";
import * as dotenv from "dotenv";
import path from "path";

// Nạp file .env ở thư mục gốc
dotenv.config({ path: path.resolve(__dirname, "../../../env") });

// Hàm tiện ích để tự động xóa dấu nháy kép "" thừa nếu có
const cleanEnv = (key: string, defaultValue: string = ""): string => {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.replace(/^"|"$/g, "").trim(); // Gọt sạch dấu nháy kép ở đầu và cuối chuỗi
};
// =========================================================================
// 1. CẤU HÌNH HẰNG SỐ HỆ THỐNG (Đọc an toàn từ .env có dấu nháy)
// =========================================================================
const WEBHOOK_URL = cleanEnv(
  "WEBHOOK_URL",
  "http://127.0.0.1:3000/api/v1/deposits/webhook-email",
);
const WEBHOOK_SECRET = cleanEnv("WEBHOOK_SECRET");
const GOOGLE_PROJECT_ID = cleanEnv(
  "GOOGLE_PROJECT_ID",
  "diesel-rhythm-502111-t8",
);
const PUB_SUB_TOPIC =
  cleanEnv("PUB_SUB_TOPIC") ||
  `projects/${GOOGLE_PROJECT_ID}/topics/gmail-bank-webhook`;
const GMAIL_REFRESH_TOKEN = cleanEnv("GMAIL_REFRESH_TOKEN");

// =========================================================================
// 2. CẤU HÌNH XÁC THỰC GMAIL API
// =========================================================================
const oauth2Client = new google.auth.OAuth2(
  cleanEnv("GOOGLE_CLIENT_ID"),
  cleanEnv("GOOGLE_CLIENT_SECRET"),
  cleanEnv(
    "GOOGLE_REDIRECT_URI",
    "https://developers.google.com/oauthplayground",
  ),
);

oauth2Client.setCredentials({
  refresh_token: GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });
const app = express();
app.use(express.json());

// =========================================================================
// 3. HÀM GỬI WEBHOOK SANG BACKEND CHỢ TÀI KHOẢN (Bất đồng bộ - Tự động thử lại)
// =========================================================================
async function sendToBackend(
  bankTxId: string,
  amount: number,
  remark: string,
  retries = 3,
) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": WEBHOOK_SECRET,
        },
        body: JSON.stringify({ bankTxId, amount, transactionRemark: remark }),
      });

      if (response.ok) {
        console.log(
          `✅ [Webhook Backend]: Giao dịch ${bankTxId} - +${amount}đ xử lý thành công.`,
        );
        return;
      } else {
        const result = (await response.json()) as any;
        console.log(
          `[Backend Response]:`,
          result?.message || "Không có phản hồi",
        );
      }
    } catch (error) {
      console.warn(
        `⚠️ [Webhook Backend]: Đơn ${bankTxId} lỗi gửi, thử lại lần ${i + 1}/${retries}...`,
      );
      await new Promise((res) => setTimeout(res, 2000));
    }
  }
  console.error(
    `❌ [Webhook Backend]: Thất bại hoàn toàn khi gửi đơn ${bankTxId} sau ${retries} lần thử!`,
  );
}

// =========================================================================
// 4. HÀM PHÂN TÍCH CÚ PHÁP EMAIL (Dựa theo chuẩn Regex chạy ngon ở file cũ)
// =========================================================================
function parseAndProcessEmail(text: string, msgId: string) {
  try {
    // Loại bỏ bớt khoảng trắng thừa để chuẩn hóa chuỗi dữ liệu giống file cũ
    const cleanText = text.replace(/[ \t]+/g, " ");

    // 1. Tìm mã giao dịch
    const txMatch = cleanText.match(
      /(?:Mã giao dịch\/\s*Transaction[\s\n]*code):\s*([0-9]+)/i,
    );
    // 2. Tìm số tiền ghi có (Đã sửa chữ 'có' chuẩn xác)
    const amountMatch = cleanText.match(
      /(?:Số tiền ghi có\/\s*Credit[\s\n]*Amount):\s*([0-9.,]+)/i,
    );
    // 3. Tìm nội dung giao dịch
    const remarkMatch = cleanText.match(
      /(?:Nội dung giao dịch\/\s*Transaction[\s\n]*remark):\s*([\s\S]*?)(?=Nếu quý khách cần|Please contact|$)/i,
    );

    if (txMatch && amountMatch && remarkMatch) {
      const bankTxId = txMatch[1].trim();
      const amount = parseInt(amountMatch[1].replace(/[.,]/g, "").trim(), 10);
      const remark = remarkMatch[1]
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (amount > 0) {
        console.log(`----------------------------------------`);
        console.log(`🎯 [Phát hiện giao dịch hợp lệ]:`);
        console.log(`- ID Thư trên Gmail: ${msgId}`);
        console.log(`- Mã GD Ngân hàng  : ${bankTxId}`);
        console.log(`- Số tiền nhận     : ${amount.toLocaleString("vi-VN")}đ`);
        console.log(`- Nội dung (Memo)  : ${remark}`);
        console.log(`----------------------------------------`);

        // Gửi sang Backend xử lý cộng tiền
        sendToBackend(bankTxId, amount, remark).catch(console.error);
      }
    } else {
      console.log(
        `⚠️ [Parser Notice]: Thư ${msgId} chứa từ khóa nhưng bóc tách lỗi.`,
      );
      console.log("[Kết quả check nhanh vùng Regex]:", {
        hasTxId: !!txMatch,
        hasAmount: !!amountMatch,
        hasRemark: !!remarkMatch,
      });
    }
  } catch (err) {
    console.error("❌ [Parser Error]: Lỗi bóc tách chuỗi dữ liệu", err);
  }
}

// =========================================================================
// 5. ROUTER TIẾP NHẬN WEBHOOK PUSH TỪ GOOGLE PUB/SUB GỬI VỀ
// =========================================================================
app.post("/api/v1/deposits/gmail-push", async (req, res) => {
  // Trả về HTTP 200 OK ngay lập tức chống Google spam gửi lại tin
  res.status(200).send("OK");

  try {
    const pubsubMessage = req.body.message;
    if (!pubsubMessage || !pubsubMessage.data) return;

    // Giải mã payload Base64 từ Google Pub/Sub
    const decodedData = Buffer.from(pubsubMessage.data, "base64").toString(
      "utf-8",
    );
    const { emailAddress } = JSON.parse(decodedData);

    console.log(
      `\n⚡ [Pub/Sub]: Hộp thư ${emailAddress} vừa nổ biến động số dư!`,
    );

    // Quét các thư CHƯA ĐỌC từ người gửi octo@cimb.com
    const response = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread from:octo@cimb.com",
    });

    const messages = response.data.messages || [];
    if (messages.length === 0) {
      console.log("ℹ️ Không tìm thấy thư nào chưa đọc khớp bộ lọc.");
      return;
    }

    // Xử lý song song tất cả email đổ về cùng thời điểm
    await Promise.all(
      messages.map(async (msg) => {
        try {
          const msgDetail = await gmail.users.messages.get({
            userId: "me",
            id: msg.id!,
            format: "full",
          });

          // Giải thuật đệ quy trích xuất nội dung thư (Bao quát toàn bộ cấu trúc Multipart của Gmail API)
          let rawBody = "";
          const tríchXuấtBody = (part: any) => {
            if (part.body?.data) {
              rawBody +=
                Buffer.from(part.body.data, "base64").toString("utf-8") + "\n";
            }
            if (part.parts) {
              for (const subPart of part.parts) {
                tríchXuấtBody(subPart);
              }
            }
          };

          const payload = msgDetail.data.payload;
          if (payload) {
            tríchXuấtBody(payload);
          }

          // Convert sang văn bản phẳng (Plain Text)
          const emailText = rawBody.includes("<html")
            ? convert(rawBody, { wordwrap: false })
            : rawBody;

          // Kiểm tra từ khóa hợp lệ giống hệt file cũ
          if (emailText.includes("CIMB") || emailText.includes("DEP")) {
            // Xóa nhãn UNREAD (Đánh dấu đã đọc) trên Server để chống xử lý lặp đơn
            await gmail.users.messages.modify({
              userId: "me",
              id: msg.id!,
              requestBody: { removeLabelIds: ["UNREAD"] },
            });
            console.log(
              `✅ Đã xóa nhãn UNREAD (Đã đọc) thành công cho thư: ${msg.id}`,
            );

            // Tiến hành phân tích bóc tách tiền nạp
            parseAndProcessEmail(emailText, msg.id!);
          } else {
            console.log(
              `ℹ️ Email ${msg.id} không chứa từ khóa nạp tiền cần tìm. Bỏ qua.`,
            );
          }
        } catch (msgErr) {
          console.error(`❌ Lỗi khi xử lý chi tiết thư ${msg.id}:`, msgErr);
        }
      }),
    );
  } catch (error) {
    console.error("❌ Lỗi luồng xử lý sự kiện Pub/Sub:", error);
  }
});

// =========================================================================
// 6. HÀM KHỞI CHẠY BOT VÀ KÍCH HOẠT THEO DÕI "WATCH" VỚI GOOGLE
// =========================================================================
export const startEmailBot = async () => {
  try {
    const res = await gmail.users.watch({
      userId: "me",
      requestBody: {
        labelIds: ["INBOX"],
        topicName: PUB_SUB_TOPIC,
      },
    });
    console.log(
      "🚀 [Gmail API Push]: Thiết lập Watch theo dõi hộp thư thành công!",
      res.data,
    );

    const PORT = 3001;
    app.listen(PORT, () => {
      console.log(
        `🌐 Server Webhook Bot Email đang hoạt động tại Port: ${PORT}`,
      );
      console.log(
        `💓 Hệ thống Real-time chuẩn Doanh Nghiệp đã sẵn sàng vận hành.`,
      );
    });
  } catch (err: any) {
    console.error(
      "❌ Không thể thiết lập lệnh Watch với Google API:",
      err.message || err,
    );
  }
};

startEmailBot();
