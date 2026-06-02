import { lazy, useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Modal, Spin, Tag, Tooltip, message } from 'antd';
import { DeleteOutlined, EditOutlined, QrcodeOutlined, WifiOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { HttpUtil, SizeFormatter } from '@/utils';
import { InfinityIcon } from '@/components/ui';
import { LazyMount } from '@/components/utility';
import { coerceInboundJsonField } from '@/models/dbinbound';
import type { ClientStats } from '@/models/dbinbound';
import type { InboundOption, ClientRecord } from '@/hooks/useClients';
import SharedQrModal from '@/components/shared/SharedQrModal';

const ClientFormModal = lazy(() => import('@/pages/clients/ClientFormModal'));

interface SubSettings {
  enable: boolean;
  subTitle?: string;
  subURI: string;
  subJsonURI: string;
  subJsonEnable: boolean;
}

interface ClientRow {
  email: string;
  enabled: boolean;
  online: boolean;
  up: number;
  down: number;
  total: number;
  subId?: string;
}

interface InboundClientsPanelProps {
  inboundId: number;
  onlineClients: string[];
  subSettings?: SubSettings;
}

async function fetchInboundDetail(id: number): Promise<unknown> {
  const msg = await HttpUtil.get(`/panel/api/inbounds/get/${id}`, undefined, { silent: true });
  if (!msg?.success || !msg.obj) throw new Error(msg?.msg || 'Failed to fetch inbound');
  return msg.obj;
}

export default function InboundClientsPanel({ inboundId, onlineClients, subSettings }: InboundClientsPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modal, modalContextHolder] = Modal.useModal();

  // QR modal state
  const [qrOpen, setQrOpen] = useState(false);
  const [qrEmail, setQrEmail] = useState('');
  const [qrSubId, setQrSubId] = useState<string | undefined>();

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientRecord | null>(null);
  const [editAttachedIds, setEditAttachedIds] = useState<number[]>([]);
  const [editInbounds, setEditInbounds] = useState<InboundOption[]>([]);
  const [editLoading, setEditLoading] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['inbound', 'detail', inboundId],
    queryFn: () => fetchInboundDetail(inboundId),
    staleTime: 30_000,
  });

  const rows = useMemo<ClientRow[]>(() => {
    if (!data) return [];
    const raw = data as Record<string, unknown>;
    const settings = coerceInboundJsonField(raw.settings);
    const rawClients = Array.isArray(settings.clients)
      ? (settings.clients as Array<{ email?: string; enable?: boolean; subId?: string }>)
      : [];

    const statsMap = new Map<string, ClientStats>();
    if (Array.isArray(raw.clientStats)) {
      for (const s of raw.clientStats as ClientStats[]) {
        if (s?.email) statsMap.set(s.email, s);
      }
    }

    return rawClients
      .filter((c) => typeof c.email === 'string' && c.email.trim() !== '')
      .map((c) => {
        const email = c.email as string;
        const stats = statsMap.get(email);
        return {
          email,
          enabled: c.enable !== false,
          online: onlineClients.includes(email),
          up: stats?.up ?? 0,
          down: stats?.down ?? 0,
          total: stats?.total ?? 0,
          subId: c.subId,
        };
      });
  }, [data, onlineClients]);

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['inbound', 'detail', inboundId] }),
      queryClient.invalidateQueries({ queryKey: ['inbounds'] }),
      queryClient.invalidateQueries({ queryKey: ['clients'] }),
    ]);
  }, [queryClient, inboundId]);

  function openQr(row: ClientRow) {
    setQrEmail(row.email);
    setQrSubId(row.subId);
    setQrOpen(true);
  }

  async function openEdit(email: string) {
    setEditLoading(email);
    try {
      const [clientMsg, optionsMsg] = await Promise.all([
        HttpUtil.get(`/panel/api/clients/get/${encodeURIComponent(email)}`),
        HttpUtil.get('/panel/api/inbounds/options', undefined, { silent: true }),
      ]);
      if (clientMsg?.success && clientMsg.obj) {
        const hydrate = clientMsg.obj as { client: ClientRecord; inboundIds: number[] };
        setEditClient({ ...hydrate.client, email } as ClientRecord);
        setEditAttachedIds(Array.isArray(hydrate.inboundIds) ? hydrate.inboundIds : [inboundId]);
      }
      if (optionsMsg?.success && Array.isArray(optionsMsg.obj)) {
        setEditInbounds(optionsMsg.obj as InboundOption[]);
      }
      setEditOpen(true);
    } catch {
      messageApi.error(t('somethingWentWrong'));
    } finally {
      setEditLoading(null);
    }
  }

  function confirmDelete(email: string) {
    modal.confirm({
      title: t('pages.clients.deleteConfirmTitle', { email }),
      content: t('pages.clients.deleteConfirmContent'),
      okText: t('delete'),
      okType: 'danger',
      cancelText: t('cancel'),
      onOk: async () => {
        const msg = await HttpUtil.post(`/panel/api/clients/del/${encodeURIComponent(email)}`);
        if (msg?.success) {
          messageApi.success(t('pages.clients.toasts.deleted'));
          await invalidate();
        } else {
          messageApi.error(msg?.msg || t('somethingWentWrong'));
        }
      },
    });
  }

  const onEditSave = useCallback(async (
    payload: Record<string, unknown> | { client: Record<string, unknown>; inboundIds: number[] },
    meta: { isEdit: false } | { isEdit: true; email: string; attach: number[]; detach: number[] },
  ) => {
    if (!meta.isEdit) return { success: false };
    const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };
    const updateMsg = await HttpUtil.post(
      `/panel/api/clients/update/${encodeURIComponent(meta.email)}`,
      payload,
      JSON_HEADERS,
    );
    if (!updateMsg?.success) return updateMsg;
    if (meta.attach.length > 0) {
      const r = await HttpUtil.post(
        `/panel/api/clients/${encodeURIComponent(meta.email)}/attach`,
        { inboundIds: meta.attach },
        JSON_HEADERS,
      );
      if (!r?.success) return r;
    }
    if (meta.detach.length > 0) {
      const r = await HttpUtil.post(
        `/panel/api/clients/${encodeURIComponent(meta.email)}/detach`,
        { inboundIds: meta.detach },
        JSON_HEADERS,
      );
      if (!r?.success) return r;
    }
    await invalidate();
    return updateMsg;
  }, [invalidate]);

  if (isLoading) {
    return (
      <div className="icp-loading">
        <Spin size="small" />
      </div>
    );
  }

  if (isError) {
    return <div className="icp-error">Failed to load clients</div>;
  }

  if (rows.length === 0) {
    return <div className="icp-empty">No clients</div>;
  }

  return (
    <div className="icp-wrap">
      {messageContextHolder}
      {modalContextHolder}

      <table className="icp-table">
        <thead>
          <tr>
            <th className="icp-th icp-th-name">Client</th>
            <th className="icp-th icp-th-used">Used</th>
            <th className="icp-th icp-th-remain">Remaining</th>
            <th className="icp-th icp-th-status">Status</th>
            <th className="icp-th icp-th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const used = row.up + row.down;
            const remaining = row.total > 0 ? row.total - used : -1;
            const usedPct = row.total > 0 ? Math.min(100, (used / row.total) * 100) : 0;

            return (
              <tr key={row.email} className="icp-row">
                <td className="icp-td icp-td-name">
                  {row.online && (
                    <Tooltip title="Online">
                      <WifiOutlined className="icp-online-dot" />
                    </Tooltip>
                  )}
                  <span className="icp-email">{row.email}</span>
                </td>

                <td className="icp-td icp-td-used">
                  <div className="icp-traffic">
                    <span className="icp-traffic-val">{SizeFormatter.sizeFormat(used)}</span>
                    {row.total > 0 && (
                      <>
                        <span className="icp-traffic-sep"> / </span>
                        <span className="icp-traffic-total">{SizeFormatter.sizeFormat(row.total)}</span>
                        <div className="icp-bar-wrap">
                          <div
                            className="icp-bar-fill"
                            style={{
                              width: `${usedPct}%`,
                              background: usedPct > 90
                                ? 'var(--ant-color-error)'
                                : usedPct > 70
                                  ? 'var(--ant-color-warning)'
                                  : 'var(--ant-color-primary)',
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </td>

                <td className="icp-td icp-td-remain">
                  {remaining >= 0
                    ? <Tag color={remaining < 1_073_741_824 ? 'orange' : 'default'}>{SizeFormatter.sizeFormat(remaining)}</Tag>
                    : <Tag color="purple"><InfinityIcon /></Tag>
                  }
                </td>

                <td className="icp-td icp-td-status">
                  <Badge
                    status={row.enabled ? 'success' : 'default'}
                    text={
                      <span className="icp-status-label">
                        {row.enabled ? t('enabled') : t('disabled')}
                      </span>
                    }
                  />
                </td>

                <td className="icp-td icp-td-actions">
                  <div className="icp-actions">
                    <Tooltip title={t('qrCode')}>
                      <Button
                        size="small"
                        type="text"
                        icon={<QrcodeOutlined />}
                        onClick={() => openQr(row)}
                      />
                    </Tooltip>
                    <Tooltip title={t('edit')}>
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        loading={editLoading === row.email}
                        onClick={() => openEdit(row.email)}
                      />
                    </Tooltip>
                    <Tooltip title={t('delete')}>
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => confirmDelete(row.email)}
                      />
                    </Tooltip>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <SharedQrModal
        open={qrOpen}
        email={qrEmail}
        subId={qrSubId}
        subSettings={subSettings}
        onClose={() => setQrOpen(false)}
      />

      <LazyMount when={editOpen}>
        <ClientFormModal
          open={editOpen}
          mode="edit"
          client={editClient}
          inbounds={editInbounds}
          attachedIds={editAttachedIds}
          save={onEditSave}
          onOpenChange={setEditOpen}
        />
      </LazyMount>
    </div>
  );
}
