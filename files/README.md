# PnL → Melody

Miniapp chuyển nhật ký giao dịch thành một giai điệu. Mỗi lệnh đóng là một nốt nhạc: lệnh lỗ nặng vang trầm, lệnh lãi lớn vang cao. Chạy hoàn toàn trên trình duyệt, không cần backend, không gửi dữ liệu đi đâu.

**Demo trực tiếp (sau khi deploy):** `https://<username>.github.io/pnl-melody/`

## Tính năng

- Kéo thả file `ReportHistory.html` xuất từ MT4/MT5 — tự động đọc và tính PnL % của từng lệnh đã đóng (theo balance trước lệnh)
- Hoặc dán thủ công một chuỗi PnL (%) cách nhau bằng dấu phẩy/xuống dòng
- 3 thang âm: ngũ cung (êm tai), trưởng (sáng), chromatic (chi tiết nhất)
- Biên độ cố định -5% / +5%, hoặc tự co giãn theo min/max thực tế của chuỗi lệnh
- Chỉnh tempo, xem lại từng lệnh dưới dạng cột (xanh = lãi, đỏ = lỗ)

## Chạy thử ở máy local

Không cần build gì cả, chỉ cần một static server vì trình duyệt chặn `fetch`/module local khi mở trực tiếp bằng `file://`:

```bash
cd pnl-melody
python3 -m http.server 8000
# mở http://localhost:8000
```

## Deploy lên GitHub Pages

```bash
# 1. Tạo repo mới trên GitHub, ví dụ pnl-melody, rồi:
cd pnl-melody
git init
git add .
git commit -m "PnL to melody miniapp"
git branch -M main
git remote add origin https://github.com/<username>/pnl-melody.git
git push -u origin main

# 2. Vào Settings > Pages trên GitHub
#    Source: Deploy from a branch
#    Branch: main / (root)
#    Lưu lại, đợi 1-2 phút là có link https://<username>.github.io/pnl-melody/
```

Nếu muốn gắn vào domain/repo `traderm0812.github.io` hiện có (cạnh `flappy-trading`), copy 3 file trong `assets/` và `index.html` vào một thư mục con, ví dụ `pnl-melody/`, rồi push — link sẽ là `https://traderm0812.github.io/pnl-melody/`.

## Cấu trúc file

```
pnl-melody/
├── index.html              giao diện chính
├── assets/
│   ├── style.css            toàn bộ style (dark trading-terminal theme)
│   ├── report-parser.js     đọc & giải mã file MT4/MT5 (UTF-16LE), tính PnL %
│   └── app.js                logic UI, thang âm, phát nhạc (Tone.js qua CDN)
└── README.md
```

## Cách tính PnL % từ báo cáo MT5

Với mỗi lệnh đóng (`direction = out`) trong bảng "Deals" của báo cáo, PnL % = `Profit / (Balance - Profit) * 100` — tức lãi/lỗ tính trên số dư ngay trước khi lệnh đó khớp.

## Ghi chú kỹ thuật

- File báo cáo MT4/MT5 xuất ra ở dạng UTF-16LE có BOM, không phải UTF-8 — `report-parser.js` tự phát hiện và giải mã đúng bằng `TextDecoder`.
- Toàn bộ xử lý (đọc file, tính toán, phát âm) chạy client-side bằng JavaScript thuần + [Tone.js](https://tonejs.github.io/) (load qua CDN cdnjs). Không có tracking, không có request nào gửi dữ liệu giao dịch ra ngoài.
