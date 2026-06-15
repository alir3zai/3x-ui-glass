import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Spin, message } from 'antd';
import { CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import { ClipboardManager, HttpUtil } from '@/utils';
import type { ClientRecord } from '@/hooks/useClients';

interface SubSettings {
  enable: boolean;
  subURI: string;
}

interface Props {
  open: boolean;
  emails: string[];
  clients: ClientRecord[];
  subSettings?: SubSettings;
  onOpenChange: (open: boolean) => void;
}

async function fetchFirstLink(email: string): Promise<string> {
  try {
    const enc = encodeURIComponent(email);
    const msg = await HttpUtil.get(`/panel/api/clients/links/${enc}`, undefined, { silent: true });
    if (msg?.success && Array.isArray(msg.obj) && msg.obj.length > 0) {
      const raw = msg.obj[0] as string;
      const base = raw.split('#')[0];
      return `${base}#${encodeURIComponent(email)}`;
    }
  } catch { /* ignore */ }
  return '';
}

export default function ExportLinksModal({ open, emails, clients, subSettings, onOpenChange }: Props) {
  const { t } = useTranslation();
  const [messageApi, ctx] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!open || emails.length === 0) return;

    const byEmail = new Map(clients.map((c) => [c.email, c]));

    setLoading(true);
    setText('');

    Promise.all(
      emails.map(async (email) => {
        const client = byEmail.get(email);
        const subId = client?.subId ?? '';

        const subLine = subSettings?.subURI && subId
          ? `${subSettings.subURI}${subId}`
          : '';

        const protoLink = await fetchFirstLink(email);

        return `---\n${email}\n${subLine}\n\n${protoLink}\n`;
      }),
    ).then((blocks) => {
      setText(blocks.join('\n') + '\n---');
      setLoading(false);
    });
  }, [open, emails, clients, subSettings]);

  function download() {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `export-links-${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {ctx}
      <Modal
        open={open}
        title={t('pages.clients.exportLinksTitle', { count: emails.length })}
        width={640}
        onCancel={() => onOpenChange(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => onOpenChange(false)}>{t('close')}</Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                icon={<CopyOutlined />}
                disabled={!text || loading}
                onClick={async () => {
                  await ClipboardManager.copyText(text);
                  messageApi.success('Copied!');
                }}
              >
                {t('pages.clients.exportLinksCopyAll')}
              </Button>
              <Button type="primary" icon={<DownloadOutlined />} disabled={!text || loading} onClick={download}>
                {t('pages.clients.exportLinksDownload')}
              </Button>
            </div>
          </div>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Spin />
          </div>
        ) : (
          <Input.TextArea
            value={text}
            readOnly
            rows={14}
            style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
          />
        )}
      </Modal>
    </>
  );
}
