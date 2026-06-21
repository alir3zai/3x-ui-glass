import { Popover } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ViolationEntry } from '@/hooks/useIpLimitViolations';

interface Props {
  entry: ViolationEntry;
  style?: React.CSSProperties;
}

export function IpViolationBadge({ entry, style }: Props) {
  const { t } = useTranslation();

  const lastTime = entry.last_time
    ? new Date(entry.last_time * 1000).toLocaleString()
    : '—';

  const content = (
    <div style={{ minWidth: 220 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        {t('pages.clients.ipLimitViolationTitle')}
      </div>
      <div>{t('pages.clients.ipLimitViolationDevices', { count: entry.last_ips.length })}</div>
      <div>{t('pages.clients.ipLimitViolationTimes', { count: entry.count })}</div>
      <div>{t('pages.clients.ipLimitViolationLast', { time: lastTime })}</div>
      <div style={{ marginTop: 4, wordBreak: 'break-all' }}>
        {t('pages.clients.ipLimitViolationIPs', { ips: entry.last_ips.join(', ') })}
      </div>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="top">
      <WarningOutlined
        style={{ color: '#ff4d4f', cursor: 'pointer', flexShrink: 0, ...style }}
      />
    </Popover>
  );
}
