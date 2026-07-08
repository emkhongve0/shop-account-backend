import Imap from "node-imap";
import { simpleParser } from "mailparser";
import { convert } from "html-to-text";

// 1. Cấu hình thông tin kết nối Gmail và API Webhook
const IMAP_CONFIG = {
  user: "nguyenxuanthinh22026@gmail.com",
  password: "ltnw lqnh qcwp iqlc", // Mật khẩu ứng dụng vừa tạo ở Bước 1
  host: "imap.gmail.com",
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
};

const WEBHOOK_URL = "http://127.0.0.1:3000/api/v1/deposits/webhook-email";
const WEBHOOK_SECRET = "Chuoi_Bi_Mat_Sieu_Cap_Cua_Rieng_Ban_123456";

const imap = new Imap(IMAP_CONFIG);

// 2. Hàm gửi dữ liệu cào được về Backend Chợ Tài Khoản
async function sendToBackend(bankTxId: string, amount: number, remark: string) {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": WEBHOOK_SECRET,
      },
      body: JSON.stringify({ bankTxId, amount, transactionRemark: remark }),
    });

    const result = (await response.json()) as any;
    console.log(`[Backend Response]:`, result.message);
  } catch (error) {
    console.error(`[Webhook Error]: Không thể kết nối tới Backend`, error);
  }
}

// 3. Hàm phân tích cú pháp Email sau khi nhận được
export function parseEmailBody(text: string) {
  try {
    // Tối ưu Regex để loại bỏ khoảng trắng phức tạp (\s+)
    const txMatch = text.match(
      /(?:Mã giao dịch|Transaction code):\s*([0-9]+)/i,
    );
    const amountMatch = text.match(
      /(?:Số tiền ghi có|Credit Amount):\s*([0-9.,]+)/i,
    );
    const remarkMatch = text.match(
      /(?:Nội dung giao dịch|Transaction remark):\s*([^\n\r]+)/i,
    );

    if (txMatch && amountMatch && remarkMatch) {
      const bankTxId = txMatch[1].trim();
      const amount = parseInt(amountMatch[1].replace(/[.,]/g, "").trim(), 10);
      const remark = remarkMatch[1].trim();

      console.log(`----------------------------------------`);
      console.log(`[Phát hiện giao dịch]:`);
      console.log(`- Mã GD Ngân hàng: ${bankTxId}`);
      console.log(`- Số tiền nhận: ${amount}đ`);
      console.log(`- Nội dung: ${remark}`);

      sendToBackend(bankTxId, amount, remark);
    } else {
      console.log(
        "⚠️ [Parser Notice]: Email chứa từ khóa nhưng không bóc tách đủ 3 trường thông tin (TxId, Amount, Remark).",
      );
    }
  } catch (err) {
    console.error("[Parser Error]: Lỗi bóc tách dữ liệu chữ", err);
  }
}

function scanUnseenEmails() {
  // Tìm các email CHƯA ĐỌC từ người gửi octo@cimb.com
  imap.search(["UNSEEN", ["FROM", "octo@cimb.com"]], (err, results) => {
    if (err || !results.length) return;

    const f = imap.fetch(results, { bodies: "" });

    f.on("message", (msg, seqno) => {
      msg.on("body", (stream, info) => {
        simpleParser(stream as any, async (err, parsed) => {
          if (err) return;

          // 1. Chuyển đổi nội dung email sang dạng text thô
          let emailText = parsed.text || "";
          if (!emailText && parsed.html) {
            emailText = convert(parsed.html, {
              wordwrap: false,
              selectors: [
                { selector: "a", options: { ignoreHref: true } },
                { selector: "img", format: "skip" },
              ],
            });
          }

          console.log(`[Bot Email] ----------------------------------------`);
          console.log(`[Đang xử lý Email số: ${seqno}]`);

          // 2. ĐÁNH DẤU ĐÃ ĐỌC NGAY LẬP TỨC
          // Đưa lên trên cùng của luồng xử lý sau khi bóc text thành công,
          // đảm bảo email này sẽ KHÔNG bao giờ bị quét lại ở lần sau nữa.
          imap.addFlags(results, ["Seen"], (err) => {
            if (err) {
              console.error(`❌ Lỗi đánh dấu đã đọc cho email ${seqno}:`, err);
            } else {
              console.log(`✅ Đã đánh dấu ĐÃ ĐỌC cho email ${seqno}`);
            }

            imap.expunge((expungeErr) => {
            if (expungeErr) console.error("Lỗi expunge đồng bộ trạng thái:", expungeErr);
            });
  
          });

          

          // 3. Kiểm tra từ khóa biến động số dư và xử lý
          // Lưu ý: Cập nhật từ khóa "DEP" thay vì "DEP-" theo cấu trúc mã mới của bạn
          if (emailText.includes("CIMB") || emailText.includes("DEP")) {
            parseEmailBody(emailText);
          } else {
            console.log(
              `ℹ️ Email ${seqno} không chứa từ khóa nạp tiền cần tìm. Bỏ qua.`,
            );
          }
        });
      });
    });
  });
}

// Thêm một biến để quản lý khoảng thời gian ping giữ mạng
let keepAliveInterval: NodeJS.Timeout;

// 5. Khởi chạy và giữ kết nối IMAP ổn định
imap.once('ready', () => {
  console.log('🤖 Bot Đọc Email Biến Động Số Dư Đã Sẵn Sàng Vận Hành!');
  
  imap.openBox("INBOX", (err, box) => {
    if (err) {
      console.error("Lỗi khi mở hộp thư INBOX:", err);
      return;
    }

    console.log(
      `Hộp thư đã mở. Chế độ hiện tại: ${box.readOnly ? "Chỉ đọc (ReadOnly)" : "Đọc-Ghi (Read-Write)"}`,
    );

    if (box.readOnly) {
      console.warn(
        "⚠️ CẢNH BÁO: Hộp thư đang bị ép vào chế độ Chỉ đọc, không thể đánh dấu đã đọc!",
      );
    }

    // Quét một lượt ngay khi khởi động bot
    scanUnseenEmails();

    // Lắng nghe sự kiện có mail mới
    imap.on("mail", () => {
      console.log("✉️ Có email mới đến! Đang tiến hành cào dữ liệu...");
      scanUnseenEmails();
    });

    // CƠ CHẾ KEEP-ALIVE: Cứ mỗi 1 phút gửi 1 lệnh "PING" (noop) để bảo Google đừng ngắt kết nối
    clearInterval(keepAliveInterval);
    keepAliveInterval = setInterval(() => {
      if (imap.state !== "disconnected") {
        try {
          // Chỉ kiểm tra email số 1 (Email đầu tiên trong hộp thư)
          // Thao tác này cực kỳ đơn giản, ép socket tương tác với Gmail mà không cần bộ lọc phức tạp
          imap.search(["1"], (err, results) => {
            if (err) {
              console.error(
                "⚠️ [Keep-Alive Error]: Không thể gửi lệnh giữ kết nối:",
                err.message,
              );
            } else {
              console.log(
                "💓 [Keep-Alive]: Thiết lập giữ kết nối với Gmail thành công!",
              );
            }
          });
        } catch (rawErr: any) {
          console.error("⚠️ [Keep-Alive Exception]:", rawErr.message || rawErr);
        }
      }
    }, 60 * 1000); // 60 giây
  });
});

// XỬ LÝ LỖI KHÔNG ĐỂ CRASH SERVER
imap.on('error', (err: any) => {
  console.error('⚠️ [IMAP Error]:', err.message || err);
  // Dọn dẹp interval tránh rò rỉ bộ nhớ khi mất kết nối
  clearInterval(keepAliveInterval); 
});

// TỰ ĐỘNG KẾT NỐI LẠI HOÀN TOÀN KHI MẤT SOCKET
imap.once('end', () => {
  console.log('🔄 Kết nối IMAP đã bị ngắt từ phía Server. Đang thiết lập kết nối lại sau 5 giây...');
  clearInterval(keepAliveInterval);
  
  setTimeout(() => {
    // Đăng ký lại các sự kiện một lần nữa trước khi connect lại để tránh mất handler
    imap.removeAllListeners();
    setupImapListeners(); // Gọi hàm thiết lập lại kết nối bên dưới
    imap.connect();
  }, 5000);
});

// Bọc luồng đăng ký lại sự kiện để phục vụ việc tái kết nối lặp đi lặp lại
function setupImapListeners() {
  // Đóng gói lại các hàm imap.once('ready'), imap.once('error'), imap.once('end') vào đây nếu cần, 
  // nhưng cách nhanh nhất để reset đối tượng imap bị lỗi EPIPE là khởi tạo lại tiến trình connect.
}

export const startEmailBot = () => {
  imap.connect();
};