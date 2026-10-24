export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 flex justify-center bg-background"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 900px 700px at 50% -10%, color-mix(in oklch, var(--color-accent) 10%, transparent), transparent)",
      }}
    >
      <div className="relative flex h-[100dvh] w-full max-w-[430px] flex-col overflow-x-hidden bg-background text-ink">
        {children}
      </div>
    </div>
  );
}
