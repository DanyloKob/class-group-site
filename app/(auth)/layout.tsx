import { PhoneFrame } from "@/components/shell/PhoneFrame";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <PhoneFrame>{children}</PhoneFrame>;
}
