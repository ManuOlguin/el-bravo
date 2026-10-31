import { Avatar } from "@/src/components/ui";
import { firstName } from "./logic";

/** "Hola, Manu" + un mensaje según cómo viene la semana (ver `greetingMessage`). */
export function Greeting({ name, photoUrl, message }: { name: string | null; photoUrl: string | null; message: string }) {
  const first = firstName(name);
  return (
    <header className="flex items-center gap-3">
      <Avatar name={name} src={photoUrl} size="lg" href="/profile" />
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-extrabold leading-tight">{first ? `Hola, ${first}` : "Hola"}</h1>
        <p className="text-sm text-fg-muted">{message}</p>
      </div>
    </header>
  );
}
