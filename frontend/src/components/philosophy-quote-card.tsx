import { ChevronLeft, ChevronRight } from "lucide-react";
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

  function move(step: number) {
    setActiveIndex((current) => {
      const next = current + step;
      if (next < 0) return PHILOSOPHY_QUOTES.length - 1;
      if (next >= PHILOSOPHY_QUOTES.length) return 0;
      return next;
    });
  }

  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <p className="text-4xl font-black leading-none text-[#ffcb05]">“</p>
        {!compact && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
            {activeIndex + 1}/{PHILOSOPHY_QUOTES.length}
          </span>
        )}
      </div>

      <p
        key={quote.text}
        className={`mt-1 animate-in fade-in duration-500 text-muted-foreground ${compact ? "min-h-15 text-sm leading-6" : "min-h-20 text-sm leading-6"}`}
      >
        {quote.text}
      </p>

      <div className={`flex items-center justify-between gap-3 ${compact ? "mt-2.5" : "mt-3"}`}>
        <p
          key={quote.author}
          className="animate-in fade-in duration-500 text-sm font-black text-[#21104a]"
        >
          {quote.author}
        </p>
        {!compact && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => move(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/50 text-primary transition hover:border-primary hover:bg-primary/10"
              aria-label="Câu trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/50 text-primary transition hover:border-primary hover:bg-primary/10"
              aria-label="Câu tiếp theo"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {!compact && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {PHILOSOPHY_QUOTES.map((item, index) => (
            <button
              key={item.text}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-1.5 rounded-full transition ${
                index === activeIndex ? "w-6 bg-primary" : "w-2 bg-primary/25"
              }`}
              aria-label={`Chọn triết lý ${index + 1}`}
            />
          ))}
        </div>
      )}

      <div className={`${compact ? "mt-2.5" : "mt-3"} h-1 overflow-hidden rounded-full bg-primary/10`}>
        <div
          key={activeIndex}
          className="h-full rounded-full bg-primary"
          style={{
            animation: `quote-progress ${QUOTE_ROTATION_MS}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}
