import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  AppWindow,
  ArrowLeft,
  BatteryCharging,
  Cable,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clipboard,
  Clock3,
  Cpu,
  Download,
  FileDown,
  FolderOpen,
  Gauge,
  HardDrive,
  Home,
  Info,
  Keyboard,
  LayoutDashboard,
  Link2,
  Monitor,
  Play,
  Radio,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Signal,
  Smartphone,
  Square,
  Terminal,
  Trash2,
  Upload,
  Usb,
  Wifi,
  X
} from 'lucide-react';
import { api } from './lib/api';
import type {
  Activity,
  AppPackage,
  BackendStatus,
  Dependency,
  Device,
  DeviceInfo,
  MDNSService,
  Page,
  AppInfo
} from './lib/types';

type Toast = { id: number; tone: 'success' | 'error' | 'info'; message: string };

type NavItem = { id: Page; label: string; icon: typeof Home };

const mainNav: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'devices', label: 'Devices', icon: Smartphone },
  { id: 'desktop', label: 'Desktop Mode', icon: Monitor },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'apps', label: 'Apps', icon: AppWindow },
  { id: 'clipboard', label: 'Clipboard', icon: Clipboard }
];

const secondaryNav: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'about', label: 'About', icon: Info }
];

const initialStatus: BackendStatus = {
  service: 'starting',
  uptimeSeconds: 0,
  adbAvailable: false,
  scrcpyAvailable: false,
  deviceCount: 0,
  message: 'Starting local service…'
};

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [status, setStatus] = useState<BackendStatus>(initialStatus);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedSerial, setSelectedSerial] = useState('');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [screenshot, setScreenshot] = useState('');
  const [apps, setApps] = useState<AppPackage[]>([]);
  const [appSearch, setAppSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [action, setAction] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pairOpen, setPairOpen] = useState(false);
  const [pairAddress, setPairAddress] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [connectAddress, setConnectAddress] = useState('');
  const [services, setServices] = useState<MDNSService[]>([]);
  const [clipboardText, setClipboardText] = useState('');
  const [pullPath, setPullPath] = useState('/sdcard/Download/');
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const toastId = useRef(0);

  const selectedDevice = useMemo(
    () => devices.find((device) => device.serial === selectedSerial) ?? null,
    [devices, selectedSerial]
  );

  const notify = useCallback((tone: Toast['tone'], message: string) => {
    const id = ++toastId.current;
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  }, []);

  const refreshData = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    const [statusResult, deviceResult, dependencyResult, activityResult] = await Promise.allSettled([
      api.status(),
      api.devices(),
      api.dependencies(),
      api.activity()
    ]);

    if (statusResult.status === 'fulfilled') setStatus(statusResult.value);
    if (dependencyResult.status === 'fulfilled') setDependencies(dependencyResult.value);
    if (activityResult.status === 'fulfilled') setActivities(activityResult.value);

    if (deviceResult.status === 'fulfilled') {
      setDevices(deviceResult.value);
      setSelectedSerial((current) => {
        if (current && deviceResult.value.some((device) => device.serial === current)) return current;
        return deviceResult.value.find((device) => device.state === 'device')?.serial ?? deviceResult.value[0]?.serial ?? '';
      });
    } else {
      setDevices([]);
      setDeviceInfo(null);
      if (!quiet) notify('error', deviceResult.reason instanceof Error ? deviceResult.reason.message : 'Could not list devices');
    }

    setLoading(false);
    setRefreshing(false);
  }, [notify]);

  useEffect(() => {
    refreshData(true);
    window.rxdc.appInfo().then(setAppInfo).catch(() => undefined);
    const remove = window.rxdc.onBackendExit(() => notify('error', 'The local backend stopped unexpectedly. Restart the app.'));
    const interval = window.setInterval(() => refreshData(true), 8000);
    return () => {
      remove();
      window.clearInterval(interval);
    };
  }, [notify, refreshData]);

  useEffect(() => {
    if (!selectedSerial) {
      setDeviceInfo(null);
      setScreenshot('');
      return;
    }
    api.deviceInfo(selectedSerial).then(setDeviceInfo).catch((error) => notify('error', error.message));
  }, [notify, selectedSerial]);

  useEffect(() => {
    if (!selectedSerial || !['dashboard', 'desktop'].includes(page)) return;
    let active = true;
    const capture = async () => {
      try {
        const image = await api.screenshot(selectedSerial);
        if (active) setScreenshot(image);
      } catch {
        if (active) setScreenshot('');
      }
    };
    capture();
    const interval = window.setInterval(capture, 1900);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [page, selectedSerial]);

  useEffect(() => {
    if (page !== 'apps' || !selectedSerial) return;
    setAction('apps');
    api.apps(selectedSerial)
      .then(setApps)
      .catch((error) => notify('error', error.message))
      .finally(() => setAction(''));
  }, [notify, page, selectedSerial]);

  const runAction = useCallback(async (name: string, task: () => Promise<unknown>, successMessage?: string) => {
    setAction(name);
    try {
      await task();
      if (successMessage) notify('success', successMessage);
      await refreshData(true);
      return true;
    } catch (error) {
      notify('error', error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setAction('');
    }
  }, [notify, refreshData]);

  const requireDevice = useCallback(() => {
    if (!selectedSerial) {
      notify('info', 'Connect and select a phone first.');
      return false;
    }
    return true;
  }, [notify, selectedSerial]);

  const launchDesktop = () => {
    if (!requireDevice()) return;
    runAction('desktop', () => api.startSession(selectedSerial), 'Desktop session launched.');
  };

  const transferFiles = async () => {
    if (!requireDevice()) return;
    const files = await window.rxdc.selectFiles();
    if (!files.length) return;
    runAction('upload', () => api.pushFiles(selectedSerial, files), `${files.length} file(s) transferred to Download.`);
  };

  const pairDevice = () => {
    if (!pairAddress.trim() || !pairCode.trim()) {
      notify('info', 'Enter the pairing address and six-digit pairing code.');
      return;
    }
    runAction('pair', () => api.pair(pairAddress.trim(), pairCode.trim()), 'Wireless debugging paired successfully.')
      .then((ok) => {
        if (ok) {
          setPairCode('');
          setPairOpen(false);
        }
      });
  };

  const connectWireless = () => {
    if (!connectAddress.trim()) {
      notify('info', 'Enter the phone IP address and debugging port.');
      return;
    }
    runAction('connect', () => api.connect(connectAddress.trim()), 'Wireless device connected.');
  };

  const discoverWireless = () => {
    runAction('discover', async () => {
      const found = await api.discovery();
      setServices(found);
      if (!found.length) notify('info', 'No wireless debugging services were discovered on this network.');
    });
  };

  const sendClipboardText = () => {
    if (!requireDevice() || !clipboardText.trim()) return;
    runAction('text', () => api.text(selectedSerial, clipboardText), 'Text sent to the focused field on your phone.');
  };

  const pullFile = async () => {
    if (!requireDevice() || !pullPath.trim()) return;
    const folder = await window.rxdc.selectFolder();
    if (!folder) return;
    runAction('pull', () => api.pullFile(selectedSerial, pullPath.trim(), folder), 'Phone file downloaded.');
  };

  const filteredApps = useMemo(() => {
    const query = appSearch.trim().toLowerCase();
    if (!query) return apps;
    return apps.filter((app) => app.label.toLowerCase().includes(query) || app.package.toLowerCase().includes(query));
  }, [appSearch, apps]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} onPage={setPage} version={appInfo?.version ?? '1.0.0'} />
      <main className="workspace">
        <Topbar
          device={selectedDevice}
          devices={devices}
          selectedSerial={selectedSerial}
          onSelect={setSelectedSerial}
          onRefresh={() => refreshData(false)}
          refreshing={refreshing}
          backendOnline={status.service === 'running'}
        />

        <section className="page-content">
          {page === 'dashboard' && (
            <Dashboard
              status={status}
              dependencies={dependencies}
              device={selectedDevice}
              info={deviceInfo}
              screenshot={screenshot}
              activities={activities}
              action={action}
              onLaunch={launchDesktop}
              onPair={() => setPairOpen(true)}
              onTransfer={transferFiles}
              onApps={() => setPage('apps')}
              onSettings={() => setPage('settings')}
              onTap={(x, y) => selectedSerial && api.tap(selectedSerial, x, y)}
              onKey={(key) => selectedSerial && api.key(selectedSerial, key)}
              onClearActivity={() => runAction('clear', api.clearActivity)}
            />
          )}

          {page === 'devices' && (
            <DevicesPage
              devices={devices}
              selectedSerial={selectedSerial}
              info={deviceInfo}
              services={services}
              action={action}
              pairAddress={pairAddress}
              connectAddress={connectAddress}
              onSelect={setSelectedSerial}
              onPairAddress={setPairAddress}
              onConnectAddress={setConnectAddress}
              onOpenPair={() => setPairOpen(true)}
              onConnect={connectWireless}
              onDisconnect={(address) => runAction('disconnect', () => api.disconnect(address), 'Wireless device disconnected.')}
              onDiscover={discoverWireless}
            />
          )}

          {page === 'desktop' && (
            <DesktopPage
              serial={selectedSerial}
              info={deviceInfo}
              screenshot={screenshot}
              action={action}
              onLaunch={launchDesktop}
              onTap={(x, y) => selectedSerial && api.tap(selectedSerial, x, y)}
              onKey={(key) => selectedSerial && api.key(selectedSerial, key)}
              onText={(text) => { if (selectedSerial) return api.text(selectedSerial, text); }}
            />
          )}

          {page === 'files' && (
            <FilesPage
              hasDevice={Boolean(selectedSerial)}
              action={action}
              pullPath={pullPath}
              onPullPath={setPullPath}
              onUpload={transferFiles}
              onPull={pullFile}
            />
          )}

          {page === 'apps' && (
            <AppsPage
              hasDevice={Boolean(selectedSerial)}
              apps={filteredApps}
              search={appSearch}
              loading={action === 'apps'}
              onSearch={setAppSearch}
              onLaunch={(packageName) => {
                if (!selectedSerial) return;
                runAction(`app:${packageName}`, () => api.launchApp(selectedSerial, packageName), 'App launched on your phone.');
              }}
              action={action}
            />
          )}

          {page === 'clipboard' && (
            <ClipboardPage
              hasDevice={Boolean(selectedSerial)}
              text={clipboardText}
              action={action}
              onText={setClipboardText}
              onSend={sendClipboardText}
            />
          )}

          {page === 'settings' && (
            <SettingsPage status={status} dependencies={dependencies} appInfo={appInfo} onOpenLogs={() => window.rxdc.openLogs()} />
          )}

          {page === 'about' && <AboutPage version={appInfo?.version ?? '1.0.0'} />}
        </section>

        <footer className="footer-bar">
          <span className={status.service === 'running' ? 'healthy' : 'unhealthy'}>
            <ShieldCheck size={15} /> {status.service === 'running' ? 'Local service operational' : 'Service unavailable'}
          </span>
          <span>Encrypted IPC <i>•</i> Private <i>•</i> Local first</span>
        </footer>
      </main>

      {pairOpen && (
        <PairModal
          address={pairAddress}
          code={pairCode}
          busy={action === 'pair'}
          onAddress={setPairAddress}
          onCode={setPairCode}
          onClose={() => setPairOpen(false)}
          onSubmit={pairDevice}
        />
      )}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast ${toast.tone}`} key={toast.id}>
            {toast.tone === 'success' ? <CheckCircle2 size={18} /> : toast.tone === 'error' ? <AlertTriangle size={18} /> : <Info size={18} />}
            <span>{toast.message}</span>
            <button onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}><X size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <img src="./icon.png" alt="R|X DC" />
      <h1><span>R|X</span> DC</h1>
      <p>Connecting to the local backend…</p>
      <div className="loading-line"><i /></div>
    </div>
  );
}

function Sidebar({ page, onPage, version }: { page: Page; onPage: (page: Page) => void; version: string }) {
  const renderItems = (items: NavItem[]) => items.map((item) => {
    const Icon = item.icon;
    return (
      <button key={item.id} className={page === item.id ? 'nav-item active' : 'nav-item'} onClick={() => onPage(item.id)}>
        <Icon size={20} />
        <span>{item.label}</span>
      </button>
    );
  });

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="./icon.png" alt="R|X DC" />
        <div><strong><em>R|X</em> DC</strong><small>Xiaomi & Redmi<br />Desktop Companion</small></div>
      </div>
      <nav>{renderItems(mainNav)}<div className="nav-rule" />{renderItems(secondaryNav)}</nav>
      <div className="sidebar-bottom">
        <div className="mini-brand"><img src="./icon.png" alt="" /><div><b>R|X DC</b><small>Unofficial project</small></div></div>
        <span>v{version}</span>
      </div>
    </aside>
  );
}

function Topbar({ device, devices, selectedSerial, onSelect, onRefresh, refreshing, backendOnline }: {
  device: Device | null;
  devices: Device[];
  selectedSerial: string;
  onSelect: (serial: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  backendOnline: boolean;
}) {
  return (
    <header className="topbar">
      <div>
        <span className={backendOnline ? 'connection-state online' : 'connection-state'}><i />{backendOnline ? 'Backend online' : 'Backend offline'}</span>
      </div>
      <div className="top-actions">
        <label className="device-select">
          <Smartphone size={16} />
          <select value={selectedSerial} onChange={(event) => onSelect(event.target.value)} aria-label="Selected device">
            {!devices.length && <option value="">No device connected</option>}
            {devices.map((item) => <option value={item.serial} key={item.serial}>{item.model || item.serial}</option>)}
          </select>
        </label>
        <span className={device ? 'connection-state online' : 'connection-state'}><i />{device ? 'Connected' : 'Waiting'}</span>
        <button className="icon-button" onClick={onRefresh} title="Refresh"><RefreshCw size={18} className={refreshing ? 'spin' : ''} /></button>
      </div>
    </header>
  );
}

function Dashboard(props: {
  status: BackendStatus;
  dependencies: Dependency[];
  device: Device | null;
  info: DeviceInfo | null;
  screenshot: string;
  activities: Activity[];
  action: string;
  onLaunch: () => void;
  onPair: () => void;
  onTransfer: () => void;
  onApps: () => void;
  onSettings: () => void;
  onTap: (x: number, y: number) => void;
  onKey: (key: string) => void;
  onClearActivity: () => void;
}) {
  return (
    <div className="dashboard-grid">
      <DeviceCard device={props.device} info={props.info} />
      <PreviewCard device={props.device} info={props.info} screenshot={props.screenshot} onTap={props.onTap} onKey={props.onKey} />
      <section className="panel quick-actions wide">
        <div className="panel-title compact"><Gauge size={18} /><h2>Quick Actions</h2></div>
        <div className="quick-buttons">
          <ActionButton icon={Monitor} label="Launch Desktop Mode" primary busy={props.action === 'desktop'} onClick={props.onLaunch} />
          <ActionButton icon={Link2} label="Pair Device" onClick={props.onPair} />
          <ActionButton icon={Upload} label="Transfer Files" busy={props.action === 'upload'} onClick={props.onTransfer} />
          <ActionButton icon={AppWindow} label="Open App Drawer" onClick={props.onApps} />
          <ActionButton icon={Settings} label="Settings" onClick={props.onSettings} />
        </div>
      </section>
      <SystemStatus status={props.status} dependencies={props.dependencies} />
      <RecentActivity activities={props.activities} onClear={props.onClearActivity} />
    </div>
  );
}

function DeviceCard({ device, info }: { device: Device | null; info: DeviceInfo | null }) {
  if (!device) {
    return (
      <section className="panel device-card">
        <EmptyState icon={Smartphone} title="No phone connected" text="Enable USB debugging, connect your Xiaomi or Redmi phone, then approve the computer on the phone." />
      </section>
    );
  }
  return (
    <section className="panel device-card">
      <div className="phone-visual"><div className="phone-camera" /><div className="phone-wallpaper" /></div>
      <div className="device-copy">
        <div className="device-heading"><div><h2>{info?.model || device.model || 'Android device'}</h2><span className="status-pill"><i />{device.state === 'device' ? 'Connected' : device.state}</span></div></div>
        <div className="device-metrics">
          <div><BatteryCharging size={29} /><span><b>{info?.batteryLevel || '—'}{info ? '%' : ''}</b><small>{info?.charging ? 'Charging' : 'Battery'}</small></span></div>
          <div><Wifi size={29} /><span><b>{device.connection === 'wireless' ? 'Wireless' : 'USB'}</b><small>{device.connection === 'wireless' ? 'Network link' : 'Direct link'}</small></span></div>
        </div>
        <div className="connection-tabs"><span className={device.connection === 'usb' ? 'active' : ''}><Usb size={15} />USB</span><span className={device.connection === 'wireless' ? 'active' : ''}><Wifi size={15} />Wireless</span></div>
        <dl className="spec-list">
          <div><dt>Android</dt><dd>{info?.androidVersion || '—'}</dd></div>
          <div><dt>System</dt><dd>{info?.hyperOsVersion ? `HyperOS ${info.hyperOsVersion}` : info?.miuiVersion ? `MIUI ${info.miuiVersion}` : '—'}</dd></div>
          <div><dt>Resolution</dt><dd>{info?.resolution || '—'}</dd></div>
          <div><dt>Storage</dt><dd>{info?.storageUsed && info.storageTotal ? `${info.storageUsed} / ${info.storageTotal}` : '—'}</dd></div>
          <div><dt>Serial</dt><dd title={device.serial}>{device.serial}</dd></div>
        </dl>
      </div>
    </section>
  );
}

function PreviewCard({ device, info, screenshot, onTap, onKey }: {
  device: Device | null;
  info: DeviceInfo | null;
  screenshot: string;
  onTap: (x: number, y: number) => void;
  onKey: (key: string) => void;
}) {
  const handleTap = (event: React.MouseEvent<HTMLImageElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * event.currentTarget.naturalWidth);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * event.currentTarget.naturalHeight);
    onTap(x, y);
  };
  return (
    <section className="panel preview-card">
      <div className="panel-title"><span className="live-dot" /><h2>Device Preview</h2><div className="title-spacer" /><span className="muted-label">{info?.resolution || 'Auto'}</span></div>
      <div className="preview-screen">
        {device && screenshot ? (
          <img src={screenshot} alt="Live phone screen" onClick={handleTap} draggable={false} />
        ) : (
          <div className="preview-placeholder">
            <Monitor size={52} />
            <h3>{device ? 'Waiting for screen capture' : 'Connect a phone to begin'}</h3>
            <p>The preview refreshes locally through ADB. Nothing is uploaded.</p>
          </div>
        )}
        <div className="preview-toolbar">
          <button onClick={() => onKey('KEYCODE_HOME')} title="Home"><Circle size={17} /></button>
          <button onClick={() => onKey('KEYCODE_BACK')} title="Back"><ArrowLeft size={18} /></button>
          <button onClick={() => onKey('KEYCODE_APP_SWITCH')} title="Recent apps"><Square size={16} /></button>
          <span />
          <small>{device ? 'Interactive preview' : 'Offline'}</small>
        </div>
      </div>
    </section>
  );
}

function ActionButton({ icon: Icon, label, primary = false, busy = false, onClick }: {
  icon: typeof Home; label: string; primary?: boolean; busy?: boolean; onClick: () => void;
}) {
  return <button className={primary ? 'action-button primary' : 'action-button'} onClick={onClick} disabled={busy}>{busy ? <RefreshCw size={20} className="spin" /> : <Icon size={20} />}<span>{label}</span></button>;
}

function SystemStatus({ status, dependencies }: { status: BackendStatus; dependencies: Dependency[] }) {
  const adb = dependencies.find((dependency) => dependency.name === 'adb');
  const scrcpy = dependencies.find((dependency) => dependency.name === 'scrcpy');
  const cards = [
    { icon: Server, label: 'Local Service', value: status.service === 'running' ? 'Running' : 'Unavailable', ok: status.service === 'running' },
    { icon: Terminal, label: 'ADB Bridge', value: adb?.available ? 'Ready' : 'Install ADB', ok: Boolean(adb?.available) },
    { icon: Radio, label: 'Discovery', value: status.adbAvailable ? 'Online' : 'Unavailable', ok: status.adbAvailable },
    { icon: HardDrive, label: 'File Transfer', value: status.adbAvailable ? 'Ready' : 'Unavailable', ok: status.adbAvailable },
    { icon: Keyboard, label: 'Input Control', value: status.adbAvailable ? 'Ready' : 'Unavailable', ok: status.adbAvailable },
    { icon: Signal, label: 'Desktop Window', value: scrcpy?.available ? 'Available' : 'Install scrcpy', ok: Boolean(scrcpy?.available) }
  ];
  return (
    <section className="panel system-panel">
      <div className="panel-title"><Server size={19} /><h2>Backend & System Status</h2></div>
      <div className="status-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return <div className="status-card" key={card.label}><span className={card.ok ? 'status-icon ok' : 'status-icon warn'}><Icon size={21} /></span><div><b>{card.label}</b><small className={card.ok ? 'ok-text' : 'warn-text'}><i />{card.value}</small></div></div>;
        })}
      </div>
    </section>
  );
}

function RecentActivity({ activities, onClear }: { activities: Activity[]; onClear: () => void }) {
  return (
    <section className="panel activity-panel">
      <div className="panel-title"><Clock3 size={19} /><h2>Recent Activity</h2><div className="title-spacer" /><button className="small-button" onClick={onClear}>Clear</button></div>
      <div className="activity-list">
        {!activities.length && <p className="quiet">No activity recorded yet.</p>}
        {activities.slice(0, 7).map((item) => (
          <div className="activity-row" key={item.id}><i className={item.level} /><time>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time><span>{item.message}</span></div>
        ))}
      </div>
    </section>
  );
}

function DevicesPage(props: {
  devices: Device[];
  selectedSerial: string;
  info: DeviceInfo | null;
  services: MDNSService[];
  action: string;
  pairAddress: string;
  connectAddress: string;
  onSelect: (serial: string) => void;
  onPairAddress: (value: string) => void;
  onConnectAddress: (value: string) => void;
  onOpenPair: () => void;
  onConnect: () => void;
  onDisconnect: (address: string) => void;
  onDiscover: () => void;
}) {
  return (
    <PageFrame title="Devices" subtitle="Connect by USB or Android wireless debugging." icon={Smartphone}>
      <div className="two-column-page">
        <section className="panel page-panel">
          <div className="panel-title"><Cable size={19} /><h2>Connected devices</h2><div className="title-spacer" /><span className="count-badge">{props.devices.length}</span></div>
          <div className="device-list">
            {!props.devices.length && <EmptyState icon={Usb} title="No ADB device detected" text="Enable Developer options and USB debugging, then reconnect your phone and approve the RSA prompt." />}
            {props.devices.map((device) => (
              <button className={props.selectedSerial === device.serial ? 'device-row selected' : 'device-row'} key={device.serial} onClick={() => props.onSelect(device.serial)}>
                <span className="device-row-icon"><Smartphone size={22} /></span>
                <span><b>{device.model || device.serial}</b><small>{device.serial} · {device.connection}</small></span>
                <span className={device.state === 'device' ? 'status-pill' : 'status-pill warning'}><i />{device.state}</span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </section>
        <section className="panel page-panel">
          <div className="panel-title"><Wifi size={19} /><h2>Wireless debugging</h2></div>
          <p className="section-help">On your phone, open Developer options → Wireless debugging. Use “Pair device with pairing code” first, then connect using the separate IP address and port shown on that screen.</p>
          <label className="field-label">Pairing address<button className="inline-link" onClick={props.onOpenPair}>Enter pairing code</button></label>
          <input className="text-input" placeholder="192.168.1.42:37123" value={props.pairAddress} onChange={(event) => props.onPairAddress(event.target.value)} />
          <label className="field-label">Connection address</label>
          <div className="input-action"><input className="text-input" placeholder="192.168.1.42:40517" value={props.connectAddress} onChange={(event) => props.onConnectAddress(event.target.value)} /><button className="primary-button" onClick={props.onConnect} disabled={props.action === 'connect'}>{props.action === 'connect' ? <RefreshCw className="spin" size={17} /> : <Link2 size={17} />}Connect</button></div>
          <div className="button-row"><button className="secondary-button" onClick={props.onDiscover} disabled={props.action === 'discover'}><Radio size={17} />Discover services</button>{props.selectedSerial.includes(':') && <button className="danger-button" onClick={() => props.onDisconnect(props.selectedSerial)}><X size={17} />Disconnect selected</button>}</div>
          {props.services.length > 0 && <div className="service-list">{props.services.map((service) => <button key={`${service.name}-${service.address}`} onClick={() => props.onConnectAddress(service.address)}><Radio size={17} /><span><b>{service.address}</b><small>{service.type}</small></span></button>)}</div>}
        </section>
      </div>
      {props.info && <section className="panel detail-strip"><div><Cpu size={20} /><span><small>Model</small><b>{props.info.model}</b></span></div><div><Terminal size={20} /><span><small>Android</small><b>{props.info.androidVersion || 'Unknown'}</b></span></div><div><BatteryCharging size={20} /><span><small>Battery</small><b>{props.info.batteryLevel}%</b></span></div><div><HardDrive size={20} /><span><small>Free space</small><b>{props.info.storageFree || 'Unknown'}</b></span></div></section>}
    </PageFrame>
  );
}

function DesktopPage({ serial, info, screenshot, action, onLaunch, onTap, onKey, onText }: {
  serial: string;
  info: DeviceInfo | null;
  screenshot: string;
  action: string;
  onLaunch: () => void;
  onTap: (x: number, y: number) => void;
  onKey: (key: string) => void;
  onText: (text: string) => Promise<unknown> | void;
}) {
  const [text, setText] = useState('');
  return (
    <PageFrame title="Desktop Mode" subtitle="Interactive local preview and optional scrcpy desktop window." icon={Monitor}>
      <section className="panel desktop-workspace">
        <div className="desktop-toolbar">
          <div><span className="live-dot" /><b>{serial ? info?.model || serial : 'No device selected'}</b><small>{info?.resolution || 'Waiting for device'}</small></div>
          <button className="primary-button" onClick={onLaunch} disabled={!serial || action === 'desktop'}>{action === 'desktop' ? <RefreshCw className="spin" size={17} /> : <Play size={17} />}Open desktop window</button>
        </div>
        <div className="desktop-preview">
          {screenshot ? <InteractiveImage source={screenshot} onTap={onTap} /> : <EmptyState icon={Monitor} title="No live preview" text="Connect an authorized ADB device. The app will capture the display locally." />}
        </div>
        <div className="desktop-controls">
          <button onClick={() => onKey('KEYCODE_BACK')}><ArrowLeft size={17} />Back</button>
          <button onClick={() => onKey('KEYCODE_HOME')}><Circle size={16} />Home</button>
          <button onClick={() => onKey('KEYCODE_APP_SWITCH')}><Square size={15} />Recent</button>
          <div className="control-text"><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Type into focused phone field" onKeyDown={(event) => { if (event.key === 'Enter' && text.trim()) { onText(text); setText(''); } }} /><button onClick={() => { if (text.trim()) { onText(text); setText(''); } }}><Send size={17} /></button></div>
        </div>
      </section>
      <div className="notice"><AlertTriangle size={18} /><div><b>Compatibility mode</b><p>The current desktop window uses scrcpy when installed. A native Samsung DeX-equivalent requires an Android-side privileged desktop shell or OEM firmware support; this repository does not bypass Xiaomi or Android security restrictions.</p></div></div>
    </PageFrame>
  );
}

function InteractiveImage({ source, onTap }: { source: string; onTap: (x: number, y: number) => void }) {
  return <img src={source} alt="Interactive device display" draggable={false} onClick={(event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onTap(Math.round(((event.clientX - rect.left) / rect.width) * event.currentTarget.naturalWidth), Math.round(((event.clientY - rect.top) / rect.height) * event.currentTarget.naturalHeight));
  }} />;
}

function FilesPage({ hasDevice, action, pullPath, onPullPath, onUpload, onPull }: {
  hasDevice: boolean; action: string; pullPath: string; onPullPath: (value: string) => void; onUpload: () => void; onPull: () => void;
}) {
  return (
    <PageFrame title="Files" subtitle="Move files directly over ADB without a cloud account." icon={FolderOpen}>
      <div className="feature-grid">
        <section className="panel feature-card"><span className="feature-icon"><Upload size={28} /></span><h2>Send files to phone</h2><p>Select one or more files. They are copied to <code>/sdcard/Download/</code> on the selected device.</p><button className="primary-button" disabled={!hasDevice || action === 'upload'} onClick={onUpload}>{action === 'upload' ? <RefreshCw className="spin" size={17} /> : <Upload size={17} />}Choose and send files</button></section>
        <section className="panel feature-card"><span className="feature-icon"><FileDown size={28} /></span><h2>Download from phone</h2><p>Enter an exact Android file or folder path, then choose a destination on this computer.</p><input className="text-input" value={pullPath} onChange={(event) => onPullPath(event.target.value)} /><button className="secondary-button" disabled={!hasDevice || action === 'pull'} onClick={onPull}>{action === 'pull' ? <RefreshCw className="spin" size={17} /> : <Download size={17} />}Choose destination and download</button></section>
      </div>
      {!hasDevice && <div className="notice"><Info size={18} /><div><b>Connect a phone first</b><p>File operations become available once an authorized ADB device is selected.</p></div></div>}
    </PageFrame>
  );
}

function AppsPage({ hasDevice, apps, search, loading, onSearch, onLaunch, action }: {
  hasDevice: boolean; apps: AppPackage[]; search: string; loading: boolean; onSearch: (value: string) => void; onLaunch: (packageName: string) => void; action: string;
}) {
  return (
    <PageFrame title="Apps" subtitle="Browse and launch user-installed Android packages." icon={AppWindow}>
      <div className="app-search"><Search size={19} /><input placeholder="Search app name or package" value={search} onChange={(event) => onSearch(event.target.value)} /><span>{apps.length} apps</span></div>
      {loading && <div className="center-loader"><RefreshCw className="spin" />Loading installed apps…</div>}
      {!loading && !hasDevice && <section className="panel"><EmptyState icon={AppWindow} title="No device selected" text="Connect a phone to view its user-installed apps." /></section>}
      {!loading && hasDevice && <div className="apps-grid">{apps.map((app) => <button className="app-card" key={app.package} onClick={() => onLaunch(app.package)} disabled={action === `app:${app.package}`}><span>{app.label.slice(0, 1).toUpperCase()}</span><div><b>{app.label}</b><small>{app.package}</small></div>{action === `app:${app.package}` ? <RefreshCw className="spin" size={17} /> : <Play size={17} />}</button>)}</div>}
    </PageFrame>
  );
}

function ClipboardPage({ hasDevice, text, action, onText, onSend }: {
  hasDevice: boolean; text: string; action: string; onText: (value: string) => void; onSend: () => void;
}) {
  return (
    <PageFrame title="Clipboard & Text" subtitle="Inject text into the currently focused field on the phone." icon={Clipboard}>
      <section className="panel text-panel"><div className="panel-title"><Keyboard size={20} /><h2>Send text</h2></div><textarea value={text} onChange={(event) => onText(event.target.value)} placeholder="Type or paste text here…" /><div><span>{text.length.toLocaleString()} characters</span><button className="primary-button" onClick={onSend} disabled={!hasDevice || !text.trim() || action === 'text'}>{action === 'text' ? <RefreshCw className="spin" size={17} /> : <Send size={17} />}Send to focused field</button></div></section>
      <div className="notice"><Info size={18} /><div><b>How it works</b><p>This uses Android's ADB input command. Tap a text field on the phone or interactive preview before sending. It is not background clipboard surveillance.</p></div></div>
    </PageFrame>
  );
}

function SettingsPage({ status, dependencies, appInfo, onOpenLogs }: {
  status: BackendStatus; dependencies: Dependency[]; appInfo: AppInfo | null; onOpenLogs: () => void;
}) {
  return (
    <PageFrame title="Settings" subtitle="Runtime dependencies and local diagnostics." icon={Settings}>
      <section className="panel settings-panel"><div className="panel-title"><Terminal size={20} /><h2>External tools</h2></div>{dependencies.map((dependency) => <div className="dependency-row" key={dependency.name}><span className={dependency.available ? 'dependency-icon ready' : 'dependency-icon'}>{dependency.name === 'adb' ? <Terminal size={20} /> : <Monitor size={20} />}</span><div><b>{dependency.name}</b><small>{dependency.available ? dependency.version || 'Detected' : `Not found. Set RXDC_${dependency.name.toUpperCase()}_PATH or add it to PATH.`}</small><code>{dependency.path || 'No executable detected'}</code></div><span className={dependency.available ? 'status-pill' : 'status-pill warning'}><i />{dependency.available ? 'Ready' : 'Missing'}</span></div>)}</section>
      <section className="panel settings-panel"><div className="panel-title"><ActivityIcon size={20} /><h2>Diagnostics</h2></div><div className="settings-list"><div><span>Backend service</span><b>{status.service}</b></div><div><span>ADB message</span><b>{status.message}</b></div><div><span>Platform</span><b>{appInfo ? `${appInfo.platform} ${appInfo.arch}` : 'Unknown'}</b></div><div><span>Logs folder</span><code>{appInfo?.logsPath || 'Loading…'}</code></div></div><button className="secondary-button" onClick={onOpenLogs}><FolderOpen size={17} />Open logs folder</button></section>
    </PageFrame>
  );
}

function AboutPage({ version }: { version: string }) {
  return (
    <PageFrame title="About" subtitle="Project identity, scope, and licensing." icon={Info}>
      <section className="panel about-card"><img src="./icon.png" alt="R|X DC" /><div><h2><em>R|X</em> DC</h2><p>Xiaomi & Redmi Desktop Companion</p><span>Version {version}</span></div></section>
      <section className="panel prose"><h2>Local-first desktop companion</h2><p>R|X DC is an independent open-source project for connecting, controlling, and transferring files to authorized Android devices. The desktop application combines a React/Electron interface with a Go backend that listens only on the local loopback interface.</p><h3>Unofficial project</h3><p>This project is not affiliated with, endorsed by, sponsored by, or produced by Xiaomi Corporation, Redmi, Google, Samsung, or the scrcpy project. Xiaomi, Redmi, Android, Samsung DeX, and other names remain the property of their respective owners.</p><h3>License</h3><p>Source code is released under the Apache License 2.0. The supplied project icon is included as project artwork provided by the repository owner.</p></section>
    </PageFrame>
  );
}

function PageFrame({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof Home; children: React.ReactNode }) {
  return <div className="page-frame"><header className="page-heading"><span><Icon size={23} /></span><div><h1>{title}</h1><p>{subtitle}</p></div></header>{children}</div>;
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof Home; title: string; text: string }) {
  return <div className="empty-state"><span><Icon size={34} /></span><h3>{title}</h3><p>{text}</p></div>;
}

function PairModal({ address, code, busy, onAddress, onCode, onClose, onSubmit }: {
  address: string; code: string; busy: boolean; onAddress: (value: string) => void; onCode: (value: string) => void; onClose: () => void; onSubmit: () => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div className="modal"><button className="modal-close" onClick={onClose}><X size={18} /></button><span className="modal-icon"><Link2 size={26} /></span><h2>Pair wireless device</h2><p>Enter the pairing IP address and port plus the six-digit code displayed by Android Wireless debugging.</p><label>Pairing address<input autoFocus className="text-input" value={address} onChange={(event) => onAddress(event.target.value)} placeholder="192.168.1.42:37123" /></label><label>Pairing code<input className="text-input code-input" value={code} onChange={(event) => onCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric" /></label><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={onSubmit} disabled={busy}>{busy ? <RefreshCw className="spin" size={17} /> : <ShieldCheck size={17} />}Pair device</button></div></div>
    </div>
  );
}

export default App;
