import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Modal, QRCode, Spin, Tag, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

import { HttpUtil, ClipboardManager } from '@/utils';
import { isPostQuantumLink } from '@/lib/xray/inbound-link';
import './SharedQrModal.css';

export interface SharedQrSubSettings {
  enable: boolean;
  subURI: string;
  subJsonURI?: string;
  subJsonEnable?: boolean;
}

export interface SharedQrModalProps {
  open: boolean;
  email: string;
  subId?: string;
  subSettings?: SharedQrSubSettings;
  onClose: () => void;
}

interface QrItem {
  key: string;
  label: string;
  value: string;
  canQr: boolean;
}

function linkRemark(link: string, fallback: string): string {
  try {
    const hash = new URL(link).hash;
    if (hash) return decodeURIComponent(hash.slice(1));
  } catch { /* ignore */ }
  return fallback;
}

function QrCard({
  item,
  onSuccess,
  onError,
}: {
  item: QrItem;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const { t } = useTranslation();

  async function doCopy() {
    const ok = await ClipboardManager.copyText(item.value);
    if (ok) {
      onSuccess(t('copied'));
    } else {
      onError('Failed to copy');
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      flex: '1 1 210px',
      minWidth: 0,
      padding: '4px 0',
    }}>
      <div
        style={{
          borderRadius: 10,
          overflow: 'hidden',
          lineHeight: 0,
          border: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        {item.canQr ? (
          <QRCode
            value={item.value || ' '}
            size={200}
            type="svg"
            bordered={false}
            color="#000000"
            bgColor="#ffffff"
            style={{ pointerEvents: 'none' }}
          />
        ) : (
          <div style={{
            width: 200,
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f5f5f5',
            fontSize: 12,
            color: '#888',
            textAlign: 'center',
            padding: 16,
          }}>
            Post-Quantum link
          </div>
        )}
      </div>
      <Tag
        color="blue"
        style={{
          maxWidth: 210,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: 11,
          margin: 0,
        }}
      >
        {item.label}
      </Tag>
      <Input
        readOnly
        value={item.value}
        size="small"
        style={{ fontSize: 10, direction: 'ltr', width: 210 }}
        addonAfter={
          <CopyOutlined style={{ cursor: 'pointer' }} onClick={doCopy} />
        }
      />
    </div>
  );
}

export default function SharedQrModal({
  open,
  email,
  subId,
  subSettings,
  onClose,
}: SharedQrModalProps) {
  const { t } = useTranslation();
  const [messageApi, holder] = message.useMessage();
  const [configLinks, setConfigLinks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !subId) { setConfigLinks([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const msg = await HttpUtil.get(
          `/panel/api/clients/subLinks/${encodeURIComponent(subId)}`,
        ) as { success?: boolean; obj?: unknown };
        if (!cancelled) {
          setConfigLinks(msg?.success && Array.isArray(msg.obj) ? msg.obj as string[] : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, subId]);

  const subLink = useMemo(() => {
    if (!subId || !subSettings?.enable || !subSettings?.subURI) return '';
    return subSettings.subURI + subId;
  }, [subId, subSettings]);

  const items = useMemo<QrItem[]>(() => {
    const out: QrItem[] = [];
    if (subLink) {
      out.push({ key: 'sub', label: t('subscription.title'), value: subLink, canQr: true });
    }
    const total = configLinks.length;
    configLinks.forEach((link, idx) => {
      const fallback = total === 1 ? email : `${email} #${idx + 1}`;
      out.push({
        key: `c${idx}`,
        label: linkRemark(link, fallback),
        value: link,
        canQr: !isPostQuantumLink(link),
      });
    });
    return out;
  }, [subLink, configLinks, email, t]);

  const isEmpty = !loading && items.length === 0;

  return (
    <Modal
      open={open}
      title={`${t('qrCode')} — ${email}`}
      footer={null}
      width={520}
      centered
      destroyOnHidden
      onCancel={onClose}
      styles={{ body: { padding: '16px 8px 8px' } }}
    >
      {holder}
      <Spin spinning={loading}>
        {isEmpty && (
          <div style={{ padding: '24px 0', textAlign: 'center', opacity: 0.55 }}>
            {!subId ? t('pages.clients.noSubId') : t('pages.clients.noLinks')}
          </div>
        )}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          justifyContent: 'center',
          minHeight: isEmpty ? 0 : 240,
        }}>
          {items.map((item) => (
            <QrCard
              key={item.key}
              item={item}
              onSuccess={(msg) => messageApi.success(msg)}
              onError={(msg) => messageApi.error(msg)}
            />
          ))}
        </div>
      </Spin>
    </Modal>
  );
}
