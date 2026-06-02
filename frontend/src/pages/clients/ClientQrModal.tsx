import SharedQrModal from '@/components/shared/SharedQrModal';
import type { ClientRecord } from '@/hooks/useClients';

interface SubSettings {
  enable: boolean;
  subURI: string;
  subJsonURI: string;
  subJsonEnable: boolean;
}

interface ClientQrModalProps {
  open: boolean;
  client: ClientRecord | null;
  subSettings?: SubSettings;
  onOpenChange: (open: boolean) => void;
}

export default function ClientQrModal({
  open,
  client,
  subSettings,
  onOpenChange,
}: ClientQrModalProps) {
  if (!client) return null;
  return (
    <SharedQrModal
      open={open}
      email={client.email}
      subId={client.subId}
      subSettings={subSettings}
      onClose={() => onOpenChange(false)}
    />
  );
}
