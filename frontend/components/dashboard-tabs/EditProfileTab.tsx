import EditProfileForm from "@/components/EditProfileForm";

export default function EditProfileTab({ publicKey }: { publicKey: string }) {
  return <EditProfileForm publicKey={publicKey} />;
}
