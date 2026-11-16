import { describe, it, expect } from "vitest";
import { getFirebaseErrorMessage, isFirebaseConfigured } from "../firebase";

describe("Firebase Auth Helpers", () => {
  it("detects configured firebase credentials", () => {
    expect(isFirebaseConfigured()).toBe(true);
  });

  it("handles auth/unauthorized-domain gracefully with helpful explanation", () => {
    const error = { code: "auth/unauthorized-domain", message: "Unauthorized domain" };
    const msg = getFirebaseErrorMessage(error);
    expect(msg).toContain("Authorized domains");
    expect(msg).toContain("Firebase Console");
  });

  it("handles auth/popup-blocked with helpful message", () => {
    const error = { code: "auth/popup-blocked", message: "Popup blocked" };
    const msg = getFirebaseErrorMessage(error);
    expect(msg).toContain("Всплывающее окно");
  });

  it("handles auth/popup-closed-by-user", () => {
    const error = { code: "auth/popup-closed-by-user" };
    const msg = getFirebaseErrorMessage(error);
    expect(msg).toContain("было закрыто");
  });

  it("handles auth/account-exists-with-different-credential", () => {
    const error = { code: "auth/account-exists-with-different-credential" };
    const msg = getFirebaseErrorMessage(error);
    expect(msg).toContain("другим способом");
  });
});
