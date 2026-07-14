import vbeeLogo from "@/assets/vbee-logo.png";
import { cn } from "@/lib/utils";

type VbeeBrandLogoProps = {
  alt?: string;
  className?: string;
  size?: "header" | "compact";
};

export function VbeeBrandLogo({
  alt = "Vbee AIVoice",
  className,
  size = "header",
}: VbeeBrandLogoProps) {
  return (
    <img
      src={vbeeLogo}
      alt={alt}
      className={cn(
        "block w-auto object-contain",
        size === "compact" ? "h-9 md:h-10" : "h-14",
        className,
      )}
    />
  );
}
