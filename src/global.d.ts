declare module '*.css' {
  const content: string;
  export default content;
}

declare namespace Spicetify {
  const React: typeof import('react');
  const ReactDOM: typeof import('react-dom');

  namespace Player {
    interface PlayerData {
      item?: {
        uri: string;
        name?: string;
        duration?: { milliseconds: number };
        isExplicit?: boolean;
        metadata?: {
          title?: string;
          artist_name?: string;
          artist_uri?: string;
          album_title?: string;
          album_uri?: string;
          image_url?: string;
          image_xlarge_url?: string;
          is_explicit?: string;
          year?: string;
          album_disc_number?: string;
        };
      };
      context_uri?: string;
      isPaused?: boolean;
    }

    const data: PlayerData | undefined;

    function addEventListener(
      type: 'songchange' | 'onplaypause' | 'onprogress',
      callback: (event?: Event) => void
    ): void;

    function removeEventListener(
      type: 'songchange' | 'onplaypause' | 'onprogress',
      callback: (event?: Event) => void
    ): void;

    function getDuration(): number;
    function getProgress(): number;
    function isPlaying(): boolean;
  }

  namespace Platform {
    interface Session {
      accessToken: string;
      accessTokenExpirationTimestampMs: number;
    }
    const Session: Session;

    interface Location {
      pathname: string;
      search: string;
      hash: string;
    }
    interface History {
      push(path: string): void;
      replace(path: string): void;
      goBack(): void;
      goForward(): void;
      listen(callback: (location: Location) => void): () => void;
      location: Location;
    }
    const History: History;

    interface LibraryAPIInterface {
      add(options: { uris: string[] }): Promise<void>;
      remove(options: { uris: string[] }): Promise<void>;
      contains(...uris: string[]): Promise<boolean[]>;
    }
    const LibraryAPI: LibraryAPIInterface;
  }

  namespace LocalStorage {
    function get(key: string): string | null;
    function set(key: string, value: string): void;
    function remove(key: string): void;
  }

  namespace Topbar {
    class Button {
      constructor(
        label: string,
        icon: string,
        onClick: () => void,
        disabled?: boolean,
        active?: boolean
      );
      label: string;
      icon: string;
      disabled: boolean;
      active: boolean;
      element: HTMLButtonElement;
    }
  }

  namespace PopupModal {
    function display(options: {
      title: string;
      content: React.ReactNode;
      isLarge?: boolean;
    }): void;
    function hide(): void;
  }

  namespace CosmosAsync {
    function get(url: string): Promise<any>;
    function post(url: string, body?: any): Promise<any>;
    function put(url: string, body?: any): Promise<any>;
    function del(url: string): Promise<any>;
  }

  function showNotification(message: string, isError?: boolean, msTimeout?: number): void;
}

declare global {
  const Spicetify: typeof Spicetify;
  const React: typeof Spicetify.React;
  const ReactDOM: typeof Spicetify.ReactDOM;

  namespace JSX {
    interface IntrinsicElements {
      div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
      span: React.DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;
      button: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
      h2: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h3: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      img: React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>;
      br: React.DetailedHTMLProps<React.HTMLAttributes<HTMLBRElement>, HTMLBRElement>;
    }
    interface Element extends React.ReactElement<any, any> {}
    interface ElementClass extends React.Component<any> {
      render(): React.ReactNode;
    }
    interface ElementAttributesProperty {
      props: {};
    }
    interface ElementChildrenAttribute {
      children: {};
    }
  }
}
