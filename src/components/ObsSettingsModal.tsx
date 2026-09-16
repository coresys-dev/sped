import { useState } from "react";
import type { ObsStatus } from "../types";
import styles from "./ObsSettingsModal.module.css";

export interface ObsSettingsModalProps {
  status: ObsStatus;
  onConnect: (host: string, port: number, password?: string) => void;
  onDisconnect: () => void;
  onClose: () => void;
}

export function ObsSettingsModal({ status, onConnect, onDisconnect, onClose }: ObsSettingsModalProps) {
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState(4455);
  const [password, setPassword] = useState("");

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>OBS Studio Connection</div>

        <label className={styles.field}>
          Host
          <input value={host} onChange={(e) => setHost(e.target.value)} />
        </label>
        <label className={styles.field}>
          Port
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
          />
        </label>
        <label className={styles.field}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="(optional)"
          />
        </label>

        <div className={styles.statusLine}>
          Status: <strong>{status.state}</strong>
          {status.state === "error" && <div className={styles.error}>{status.message}</div>}
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={onDisconnect}>
            Disconnect
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => onConnect(host, port, password || undefined)}
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}
