import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

const QUOTE_ROTATION_MS = 5000;

const PHILOSOPHY_QUOTES = [
  {
    text: "Learn from yesterday, live for today, hope for tomorrow. The important thing is not to stop questioning.",
    author: "ALBERT EINSTEIN",
  },
  {
    text: "Tập trung là biết nói không với những điều làm đội ngũ đi chệch khỏi mục tiêu.",
    author: "STEVE JOBS",
  },
  {
    text: "Hành trình dài nhất luôn bắt đầu bằng một bước chân nhỏ nhưng dứt khoát.",
    author: "LÃO TỬ",
  },
  {
    text: "Điều quan trọng không phải là biết tất cả, mà là luôn biết mình cần học thêm.",
    author: "SOCRATES",
  },
  {
    text: "Thành công không đến trước công việc, trừ khi bạn chỉ đang đọc từ điển.",
    author: "VINCE LOMBARDI",
  },
  {
    text: "Công nghệ tốt nhất là công nghệ giúp con người làm việc tự nhiên hơn mỗi ngày.",
    author: "VBEE TEAM",
  },
  {
    text: "Muốn sản phẩm đi xa, hãy làm cho trải nghiệm đầu tiên thật dễ hiểu.",
    author: "PRODUCT PRINCIPLE",
  },
];

export function PhilosophyQuoteCard() {
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
    <div className="rounded-2xl border border-border bg-card/85 p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <p className="text-5xl font-black leading-none text-primary/30">“</p>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
          {activeIndex + 1}/{PHILOSOPHY_QUOTES.length}
        </span>
      </div>

      <p
        key={quote.text}
        className="mt-1 min-h-24 animate-in fade-in duration-500 text-sm leading-6 text-muted-foreground"
      >
        {quote.text}
      </p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p
          key={quote.author}
          className="animate-in fade-in duration-500 text-sm font-black text-primary"
        >
          {quote.author}
        </p>
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
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {PHILOSOPHY_QUOTES.map((item, index) => (
          <button
            key={item.author}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`h-1.5 rounded-full transition ${
              index === activeIndex ? "w-6 bg-primary" : "w-2 bg-primary/25"
            }`}
            aria-label={`Chọn triết lý ${index + 1}`}
          />
        ))}
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-primary/10">
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
