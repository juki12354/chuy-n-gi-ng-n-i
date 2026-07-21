import { useEffect, useState } from "react";

const QUOTE_ROTATION_MS = 5000;

const PHILOSOPHY_QUOTES = [
  {
    text: "Học hỏi từ hôm qua, sống cho hôm nay, hy vọng cho ngày mai. Điều quan trọng là không ngừng đặt câu hỏi.",
    author: "ALBERT EINSTEIN",
  },
  {
    text: "Không có gì trong cuộc sống phải sợ hãi, chỉ có những điều cần được thấu hiểu.",
    author: "MARIE CURIE",
  },
  {
    text: "Tôi nghĩ, nên tôi tồn tại.",
    author: "RENÉ DESCARTES",
  },
  {
    text: "Những gì chúng ta làm hôm nay có thể cải thiện tương lai.",
    author: "NELSON MANDELA",
  },
  {
    text: "Đơn giản là sự tinh tế tối thượng.",
    author: "LEONARDO DA VINCI",
  },
  {
    text: "Không quan trọng bạn đi chậm thế nào, miễn là bạn không dừng lại.",
    author: "KHỔNG TỬ",
  },
  {
    text: "Tương lai phụ thuộc vào những gì bạn làm hôm nay.",
    author: "MAHATMA GANDHI",
  },
  {
    text: "Điều duy nhất tôi biết là tôi không biết gì cả.",
    author: "SOCRATES",
  },
  {
    text: "Bạn có quyền làm chủ tâm trí mình, không phải những sự việc bên ngoài.",
    author: "MARCUS AURELIUS",
  },
  {
    text: "Không phải sự việc làm con người phiền lòng, mà là cách họ nhìn nhận sự việc.",
    author: "EPICTETUS",
  },
  {
    text: "Lạc quan là niềm tin dẫn tới thành tựu. Không thể làm được gì nếu thiếu hy vọng và tự tin.",
    author: "HELEN KELLER",
  },
  {
    text: "Thời điểm luôn luôn đúng để làm điều đúng đắn.",
    author: "MARTIN LUTHER KING JR.",
  },
  {
    text: "Biết điều cần phải làm sẽ xóa đi nỗi sợ hãi.",
    author: "ROSA PARKS",
  },
  {
    text: "Tôi không thất bại. Tôi chỉ tìm ra những cách chưa hiệu quả.",
    author: "THOMAS EDISON",
  },
  {
    text: "Đầu tư vào tri thức luôn mang lại lợi ích tốt nhất.",
    author: "BENJAMIN FRANKLIN",
  },
  {
    text: "Nơi nào có hy vọng, nơi đó có sự sống.",
    author: "ANNE FRANK",
  },
  {
    text: "Mọi người có thể quên điều bạn nói, nhưng họ sẽ nhớ cảm giác bạn mang lại cho họ.",
    author: "MAYA ANGELOU",
  },
  {
    text: "Cách tốt nhất để tìm thấy chính mình là hết lòng phụng sự người khác.",
    author: "MAHATMA GANDHI",
  },
  {
    text: "Lấy đại nghĩa để thắng hung tàn, lấy chí nhân để thay cường bạo.",
    author: "NGUYỄN TRÃI",
  },
  {
    text: "Chữ tâm kia mới bằng ba chữ tài.",
    author: "NGUYỄN DU",
  },
  {
    text: "Không có con đường dẫn đến hạnh phúc. Hạnh phúc chính là con đường.",
    author: "THÍCH NHẤT HẠNH",
  },
];

export function PhilosophyQuoteCard({ compact = false }: { compact?: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const quote = PHILOSOPHY_QUOTES[activeIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % PHILOSOPHY_QUOTES.length);
    }, QUOTE_ROTATION_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-soft">
      <div className="flex items-start">
        <p className="text-4xl font-black leading-none text-[#ffcb05]">“</p>
      </div>

      <p
        key={quote.text}
        className={`mt-1 animate-in fade-in duration-500 text-muted-foreground ${compact ? "min-h-15 text-sm leading-6" : "min-h-20 text-sm leading-6"}`}
      >
        {quote.text}
      </p>

      <div className={compact ? "mt-2.5" : "mt-3"}>
        <p
          key={quote.author}
          className="animate-in fade-in duration-500 text-sm font-black text-[#21104a]"
        >
          {quote.author}
        </p>
      </div>
    </div>
  );
}
