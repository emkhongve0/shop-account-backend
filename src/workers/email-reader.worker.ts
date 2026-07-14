// src/features/deposit/bot/emailBot.ts
import { google } from "googleapis";
import { convert } from "html-to-text";
import express from "express";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../env") });

const cleanEnv = (key: string, defaultValue: string = ""): string => {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.replace(/^\"|\"$/g, "").trim();
};

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

const oauth2Client = new google.auth.OAuth2(
  cleanEnv("GOOGLE_CLIENT_ID"),
  cleanEnv("GOOGLE_CLIENT_SECRET"),
  cleanEnv(
    "GOOGLE_REDIRECT_URI",
    "https://developers.google.com/oauthplayground",
  ),
);

oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
const gmail = google.gmail({ version: "v1", auth: oauth2Client });

// Bộ nhớ đệm chống trùng lặp (Idempotency Cache) lưu các Gmail Message ID đang được xử lý
const processingMessages = new Set<string>(); //

const app = express();
app.use(express.json());

// Định nghĩa các kiểu kết quả trả về từ webhook để phân loại lỗi
interface WebhookResult {
  status: "SUCCESS" | "ALREADY_PROCESSED" | "FAILED";
  message?: string;
}

// =========================================================================
// 1. HÀM GỬI WEBHOOK SANG BACKEND (Trả về trạng thái chi tiết)
// =========================================================================
async function sendToBackend(
  bankTxId: string,
  amount: number,
  remark: string,
  retries = 3,
): Promise<WebhookResult> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": WEBHOOK_SECRET, //
        },
        body: JSON.stringify({ bankTxId, amount, transactionRemark: remark }), //
      });

      const result = (await response.json()) as any;

      if (response.ok) {
        console.log(
          `✅ [Webhook Backend]: Giao dịch ${bankTxId} - +${amount}đ xử lý thành công.`, //
        );
        return { status: "SUCCESS" };
      }

      // KIỂM TRA TRÙNG LẶP: Nếu Backend trả về lỗi 409 (Conflict) hoặc thông báo đã xử lý trước đó
      if (
        response.status === 409 ||
        (result?.message &&
          (result.message.includes("đã tồn tại") ||
            result.message.includes("đã được xử lý") ||
            result.message.includes("already processed") ||
            result.message.includes("duplicate")))
      ) {
        console.log(
          `ℹ️ [Webhook Backend]: Giao dịch ${bankTxId} đã được cộng tiền/xử lý trước đó rồi. Không xử lý lại.`,
        );
        return { status: "ALREADY_PROCESSED", message: result?.message };
      }

      console.error(
        `❌ [Backend Error Response]:`,
        result?.message || "Không có phản hồi từ API", //
      );
    } catch (error) {
      console.warn(
        `⚠️ [Webhook Backend]: Đơn ${bankTxId} lỗi kết nối, thử lại lần ${i + 1}/${retries}...`, //
      );
      await new Promise((res) => setTimeout(res, 3000)); //
    }
  }
  return { status: "FAILED" };
}

// =========================================================================
// 2. PHÂN TÍCH CÚ PHÁP EMAIL & TRẢ VỀ KẾT QUẢ ĐỂ PHÂN LOẠI XỬ LÝ
// =========================================================================
async function parseAndProcessEmail(
  text: string,
  msgId: string,
): Promise<WebhookResult> {
  try {
    const cleanText = text.replace(/[ \t]+/g, " "); //

    // 1. Tìm mã giao dịch
    const txMatch = cleanText.match(
      /(?:Mã giao dịch\/\s*Transaction[\s\n]*code):\s*([0-9]+)/i, //
    );

    // 2. Tìm số tiền
    const amountMatch = cleanText.match(
      /(?:Số tiền ghi có\/\s*Credit[\s\n]*Amount):\s*([0-9.,]+)/i, //
    );

    // 3. Tìm nội dung giao dịch
    const remarkMatch = cleanText.match(
      /(?:Nội dung giao dịch\/\s*Transaction[\s\n]*remark):\s*([\s\S]*?)(?=Nếu quý khách cần|Please contact|$)/i, //
    );

    if (txMatch && amountMatch && remarkMatch) {
      //
      const bankTxId = txMatch[1].trim(); //

      let rawAmountStr = amountMatch[1].trim(); //
      if (rawAmountStr.endsWith(".00") || rawAmountStr.endsWith(",00")) {
        //
        rawAmountStr = rawAmountStr.substring(0, rawAmountStr.length - 3); //
      }
      const amount = parseInt(rawAmountStr.replace(/[.,]/g, ""), 10); //

      const remark = remarkMatch[1] //
        .replace(/[\r\n]+/g, " ") //
        .replace(/\s+/g, " ") //
        .trim(); //

      if (amount > 0 && /\bDEP[0-9]{6}\b/i.test(remark)) {
        //
        console.log(`----------------------------------------`);
        console.log(`🎯 [Phát hiện giao dịch nạp tiền]:`);
        console.log(`- Mã GD Ngân hàng  : ${bankTxId}`);
        console.log(`- Số tiền nhận     : ${amount.toLocaleString("vi-VN")}đ`);
        console.log(`- Nội dung (Memo)  : ${remark}`);
        console.log(`----------------------------------------`);

        return await sendToBackend(bankTxId, amount, remark);
      } else {
        console.log(
          `⚠️ [Parser Skip]: Giao dịch không chứa mã nạp hợp lệ (DEPxxxxxx) hoặc số tiền bằng 0.`, //
        );
      }
    } else {
      console.log(
        `⚠️ [Parser Notice]: Thư ${msgId} thiếu các trường dữ liệu cần thiết để bóc tách.`, //
      );
    }
  } catch (err) {
    console.error("❌ [Parser Error]: Lỗi bóc tách chuỗi dữ liệu", err); //
  }
  return { status: "FAILED" };
}

// =========================================================================
// 3. ROUTER TIẾP NHẬN WEBHOOK PUSH TỪ GOOGLE PUB/SUB
// =========================================================================
app.post("/api/v1/deposits/gmail-push", async (req, res) => {
  res.status(200).send("OK"); //

  try {
    const pubsubMessage = req.body.message; //
    if (!pubsubMessage || !pubsubMessage.data) return; //

    const decodedData = Buffer.from(pubsubMessage.data, "base64").toString(
      "utf-8",
    ); //
    const { emailAddress } = JSON.parse(decodedData); //

    console.log(
      `\n⚡ [Pub/Sub]: Hộp thư ${emailAddress} vừa nổ biến động số dư!`, //
    );

    const response = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread from:octo@cimb.com",
    });

    const messages = response.data.messages || []; //
    if (messages.length === 0) return; //

    await Promise.all(
      messages.map(async (msg) => {
        const messageId = msg.id!; //

        if (processingMessages.has(messageId)) {
          //
          console.log(
            `ℹ️ Thư ${messageId} đang được xử lý bởi luồng khác. Bỏ qua.`, //
          );
          return;
        }
        processingMessages.add(messageId); //

        try {
          const msgDetail = await gmail.users.messages.get({
            userId: "me",
            id: messageId,
            format: "full",
          }); //

          let rawBody = ""; //
          const tríchXuấtBody = (part: any) => {
            //
            if (part.body?.data) {
              //
              rawBody +=
                Buffer.from(part.body.data, "base64").toString("utf-8") + "\n"; //
            }
            if (part.parts) {
              //
              for (const subPart of part.parts) {
                //
                tríchXuấtBody(subPart); //
              }
            }
          };

          const payload = msgDetail.data.payload; //
          if (payload) tríchXuấtBody(payload); //

          const emailText = rawBody.includes("<html") //
            ? convert(rawBody, { wordwrap: false }) //
            : rawBody; //

          if (emailText.includes("CIMB") || emailText.includes("DEP")) {
            //
            // Nhận trạng thái chi tiết từ Backend
            const result = await parseAndProcessEmail(emailText, messageId);

            if (result.status === "SUCCESS") {
              console.log(
                `✅ [Tự động]: Thư ${messageId} đã được xử lý và cộng tiền tự động thành công.`, //
              );
            } else if (result.status === "ALREADY_PROCESSED") {
              // LOG ĐẶC BIỆT: Đã được xử lý từ trước -> Kết thúc luôn, không chuyển Admin cộng tay
              console.log(
                `⏭️ [Bỏ qua]: Thư ${messageId} đã được cộng tiền/xử lý trước đó rồi. Kết thúc tác vụ tại đây.`,
              );
            } else {
              // THẤT BẠI THỰC SỰ -> Chuyển Admin duyệt tay
              console.warn(
                `❌ [Xử lý thất bại]: Thư ${messageId} lỗi xử lý tự động tại Backend.`, //
              );
              console.log(
                `⚠️ [Chuyển xử lý thủ công]: Thư ${messageId} đã được chuyển sang danh sách chờ Admin cộng tay.`, //
              );
            }
          } else {
            console.log(
              `🧹 Thư ${messageId} không chứa từ khóa nạp tiền. Bỏ qua và dọn dẹp.`, //
            );
          }
        } catch (msgErr) {
          console.error(`❌ Lỗi khi xử lý chi tiết thư ${messageId}:`, msgErr); //
        } finally {
          try {
            // LUÔN LUÔN đánh dấu ĐÃ ĐỌC (xóa UNREAD) trong khối finally để giải phóng hòm thư
            await gmail.users.messages.modify({
              userId: "me",
              id: messageId,
              requestBody: { removeLabelIds: ["UNREAD"] },
            }); //
            console.log(
              `🧹 [Dọn dẹp]: Thư ${messageId} đã được đánh dấu ĐÃ ĐỌC.`, //
            );
          } catch (modifyErr) {
            console.error(
              `❌ Không thể đánh dấu đã đọc cho thư ${messageId}:`, //
              modifyErr,
            );
          }

          processingMessages.delete(messageId); //
        }
      }),
    );
  } catch (error) {
    console.error("❌ Lỗi luồng xử lý sự kiện Pub/Sub:", error); //
  }
});

// =========================================================================
// 4. KHỞI CHẠY BOT VÀ KÍCH HOẠT WATCH GMAIL API
// =========================================================================
export const startEmailBot = async () => {
  try {
    const res = await gmail.users.watch({
      userId: "me",
      requestBody: {
        labelIds: ["INBOX"],
        topicName: PUB_SUB_TOPIC,
      },
    }); //
    console.log(
      "🚀 [Gmail API Push]: Thiết lập Watch theo dõi hộp thư thành công!", //
      res.data,
    );

    const PORT = 3001;
    app.listen(PORT, () => {
      console.log(
        `🌐 Server Webhook Bot Email đang hoạt động tại Port: ${PORT}`, //
      );
    });
  } catch (err: any) {
    console.error(
      "❌ Không thể thiết lập lệnh Watch với Google API:", //
      err.message || err,
    );
  }
};

startEmailBot();
