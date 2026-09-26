"use client";

import { useEffect } from "react";

export default function StoragePersistence() {
  useEffect(() => {
    if (navigator.storage?.persist) {
      navigator.storage.persisted().then((already) => {
        if (!already) {
          navigator.storage.persist();
        }
      });
    }
  }, []);

  return null;
}
