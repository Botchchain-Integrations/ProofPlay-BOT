export function teamInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "?";
  }

  const words = trimmed.split(" ").filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return words.length === 1 ? letters[0] : letters;
}

type TeamEmblemProps = {
  name: string;
  size?: "sm" | "lg";
  className?: string;
};

export function TeamEmblem({ name, size = "sm", className = "" }: TeamEmblemProps) {
  const px = size === "lg" ? "3.5rem" : "2rem";
  const fontSize = size === "lg" ? "1.125rem" : "0.75rem";

  return (
    <span
      className={`team-emblem ${className}`}
      style={{ width: px, height: px, fontSize }}
      aria-hidden="true"
    >
      {teamInitials(name)}
    </span>
  );
}