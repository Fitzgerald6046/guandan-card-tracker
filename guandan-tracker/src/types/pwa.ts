export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

export interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export interface WindowWithAnalytics extends Window {
  gtag?: (
    command: 'event',
    eventName: string,
    parameters: Record<string, string>
  ) => void;
}

export interface ServiceWorkerRegistrationWithSync
  extends ServiceWorkerRegistration {
  sync?: {
    register: (tag: string) => Promise<void>;
  };
}
