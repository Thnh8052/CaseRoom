import { useCallback, useEffect, useState } from "react";

type UsePushToTalkOptions = {
  enabled: boolean;
  onChange: (active: boolean) => void | Promise<void>;
  keyName?: string;
};

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) || element.isContentEditable;
}

/**
 * Hook quản lý phím tắt Push To Talk (Mặc định là phím V).
 * Lắng nghe sự kiện bàn phím nhưng tự động bỏ qua nếu người dùng đang gõ Text (input, textarea).
 */
export function usePushToTalk({ enabled, onChange, keyName = "v" }: UsePushToTalkOptions) {
  const [isPushToTalkDown, setIsPushToTalkDown] = useState(false);

  const setActive = useCallback(async (active: boolean) => {
    if (!enabled) return;
    setIsPushToTalkDown(active);
    await onChange(active);
  }, [enabled, onChange]);

  const startPushToTalk = useCallback(() => {
    void setActive(true);
  }, [setActive]);

  const stopPushToTalk = useCallback(() => {
    void setActive(false);
  }, [setActive]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!enabled || event.repeat || isTypingTarget(event.target)) return;
      if (event.key.toLowerCase() === keyName.toLowerCase()) {
        event.preventDefault();
        void setActive(true);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!enabled || isTypingTarget(event.target)) return;
      if (event.key.toLowerCase() === keyName.toLowerCase()) {
        event.preventDefault();
        void setActive(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [enabled, keyName, setActive]);

  useEffect(() => {
    if (!enabled && isPushToTalkDown) {
      void onChange(false);
      setIsPushToTalkDown(false);
    }
  }, [enabled, isPushToTalkDown, onChange]);

  return {
    isPushToTalkDown,
    startPushToTalk,
    stopPushToTalk
  };
}
