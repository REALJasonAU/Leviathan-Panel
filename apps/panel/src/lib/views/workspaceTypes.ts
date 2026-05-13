import type {
  AuditLogRecord,
  BackupRecord,
  DomainMappingRecord,
  FileEntryRecord,
  FirewallRuleRecord,
  MetricPointRecord,
  ScheduledTaskRecord,
  ServerRecord,
  SftpCredentialRecord,
} from "@voltan/shared";

export type WorkspaceSection =
  | "console"
  | "files"
  | "databases"
  | "schedules"
  | "users"
  | "backups"
  | "network"
  | "startup"
  | "settings"
  | "activity";

export type WorkspaceTab = {
  id: WorkspaceSection;
  label: string;
};

export type UserWorkspaceActions = {
  openNotifications: () => void;
  openProfile: () => void;
  signOut: () => void;
};

export type ServerWorkspaceActions = {
  sendConsoleCommand: () => Promise<void> | void;
  clearConsole: () => void;
  copyLatestConsoleError: () => Promise<void> | void;
  browseFiles: (path: string) => Promise<void> | void;
  openFile: (path: string) => Promise<void> | void;
  saveFile: () => Promise<void> | void;
  confirmDeleteFile: (path: string) => void;
  uploadFile: (event: Event) => Promise<void> | void;
  downloadFile: (path: string) => Promise<void> | void;
  createFolder: () => Promise<void> | void;
  createBackup: () => Promise<void> | void;
  restoreBackup: (id: string) => void;
  deleteBackup: (id: string) => void;
  downloadBackup: (id: string) => Promise<void> | void;
  createTask: () => Promise<void> | void;
  runTask: (id: string) => Promise<void> | void;
  addSubUser: () => Promise<void> | void;
  removeSubUser: (userId: string) => void;
  createDomainMapping: () => Promise<void> | void;
  createFirewallRule: () => Promise<void> | void;
  applyFirewallRules: (dryRun?: boolean) => Promise<void> | void;
  confirmApplyFirewallRules: () => void;
  rotateSftp: () => Promise<void> | void;
  updateServerEnvironment: () => Promise<void> | void;
  deleteServer: () => void;
  powerServer: (action: string) => Promise<void> | void;
};

export type UserWorkspaceModel = {
  loading: boolean;
  error: string;
  userDisplayName: string;
  userEmail?: string | null;
  servers: ServerRecord[];
  selectedServer: ServerRecord | null;
  selectedServerId: string;
  serverMetric: MetricPointRecord | null;
  serverBackups: BackupRecord[];
  serverTasks: ScheduledTaskRecord[];
  serverFiles: FileEntryRecord[];
  serverMembers: ServerRecord["members"];
  serverDomains: DomainMappingRecord[];
  serverFirewallRules: FirewallRuleRecord[];
  sftpCredential: SftpCredentialRecord | null;
  auditLogs: AuditLogRecord[];
  consoleLines: string[];
  commandHistory: string[];
  tabs: WorkspaceTab[];
  createTaskForm: {
    name: string;
    cron: string;
    actionType: "power" | "command";
    powerAction: "restart" | "start" | "stop" | "kill";
    command: string;
  };
  subUserForm: {
    userId: string;
    permissions: string;
  };
  domainForm: {
    domain: string;
    targetPort: string;
  };
  firewallForm: {
    protocol: "tcp" | "udp";
    port: string;
    source: string;
    action: "allow" | "deny";
  };
  actions: UserWorkspaceActions;
};
