/**
 * In-app update checker using GitHub Releases API
 */

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  downloadUrl: string;
  publishedAt: string;
}

export const APP_CURRENT_VERSION = "1.1.0";
const GITHUB_REPO = "Zinn1k/zinapse";

function parseVersion(v: string): number[] {
  return v
    .replace(/^v/i, "")
    .split(".")
    .map((num) => parseInt(num, 10) || 0);
}

export function isNewerVersion(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);

  const len = Math.max(l.length, c.length);
  for (let i = 0; i < len; i++) {
    const lPart = l[i] ?? 0;
    const cPart = c[i] ?? 0;
    if (lPart > cPart) return true;
    if (lPart < cPart) return false;
  }
  return false;
}

export async function checkForAppUpdates(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      if (res.status === 404) {
        // No releases published yet
        return null;
      }
      return null;
    }

    interface GhAsset {
      name: string;
      browser_download_url: string;
    }

    interface GhRelease {
      tag_name: string;
      name?: string;
      body?: string;
      published_at?: string;
      html_url: string;
      assets?: GhAsset[];
    }

    const data: GhRelease = await res.json();
    const rawTag = data.tag_name || "";
    const cleanTag = rawTag.replace(/^v/i, "");

    const hasUpdate = isNewerVersion(cleanTag, APP_CURRENT_VERSION);

    // Look for .apk asset
    const apkAsset = data.assets?.find((a) => a.name.toLowerCase().endsWith(".apk"));
    const downloadUrl = apkAsset?.browser_download_url || data.html_url;

    return {
      hasUpdate,
      currentVersion: APP_CURRENT_VERSION,
      latestVersion: cleanTag,
      releaseName: data.name || rawTag,
      releaseNotes: data.body || "",
      downloadUrl,
      publishedAt: data.published_at || new Date().toISOString(),
    };
  } catch (err) {
    console.warn("Failed to check for updates:", err);
    return null;
  }
}
