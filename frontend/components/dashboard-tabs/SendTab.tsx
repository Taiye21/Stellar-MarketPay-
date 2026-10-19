import SendPaymentForm from "@/components/SendPaymentForm";

export default function SendTab({ publicKey }: { publicKey: string }) {
  return <SendPaymentForm fromPublicKey={publicKey} />;
}
