const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const env = (key: string, fallback = "") => {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : fallback;
};

export const PROJECT_CONFIG = {
  name: env("NEXT_PUBLIC_PROJECT_NAME", "Git City"),
  ownerDisplayName: env("NEXT_PUBLIC_OWNER_DISPLAY_NAME", "Hardik Kaurani"),
  ownerGithubLogin: env("NEXT_PUBLIC_OWNER_GITHUB_LOGIN", "hardikkaurani").toLowerCase(),
  ownerGithubUrl: env("NEXT_PUBLIC_OWNER_GITHUB_URL", "https://github.com/hardikkaurani"),
  repositoryOwner: env("NEXT_PUBLIC_REPOSITORY_OWNER", "hardikkaurani"),
  repositoryName: env("NEXT_PUBLIC_REPOSITORY_NAME", "Git-City"),
  projectUrl: trimTrailingSlash(
    env("NEXT_PUBLIC_PROJECT_URL", env("NEXT_PUBLIC_APP_URL", env("NEXT_PUBLIC_BASE_URL", "http://localhost:3001"))),
  ),
  discordUrl: env("NEXT_PUBLIC_DISCORD_URL", ""),
  discordInviteApiUrl: env("NEXT_PUBLIC_DISCORD_INVITE_API_URL", ""),
  contactEmail: env("NEXT_PUBLIC_CONTACT_EMAIL", "hardikkaurani1@gmail.com"),
  supportEmail: env("NEXT_PUBLIC_SUPPORT_EMAIL", "hardikkaurani1@gmail.com"),
  xHandle: env("NEXT_PUBLIC_X_HANDLE", ""),
  emailFrom: env("EMAIL_FROM", env("NEXT_PUBLIC_EMAIL_FROM", "Git City <noreply@example.com>")),
  adminNotificationEmail: env("ADMIN_NOTIFICATION_EMAIL", "hardikkaurani1@gmail.com"),
};

export const PROJECT_REPOSITORY = `${PROJECT_CONFIG.repositoryOwner}/${PROJECT_CONFIG.repositoryName}`;
export const PROJECT_REPOSITORY_URL = `https://github.com/${PROJECT_REPOSITORY}`;
export const PROJECT_ISSUES_URL = `${PROJECT_REPOSITORY_URL}/issues`;
export const PROJECT_SECURITY_URL = `${PROJECT_REPOSITORY_URL}/security/advisories`;

export function projectUrl(path = "") {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${PROJECT_CONFIG.projectUrl}${path ? suffix : ""}`;
}

export function publicUrlForDisplay() {
  return PROJECT_CONFIG.projectUrl.replace(/^https?:\/\//, "");
}

export function githubApiRepoUrl() {
  return `https://api.github.com/repos/${PROJECT_REPOSITORY}`;
}

export function xUrl() {
  return PROJECT_CONFIG.xHandle ? `https://x.com/${PROJECT_CONFIG.xHandle.replace(/^@/, "")}` : "";
}
